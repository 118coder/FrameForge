//! FrameForge 像素工具箱 —— 单文件服务器
//! 把 web/ 全部资源用 include_dir 嵌入 exe，双击即用：
//! 自动探测端口 → 启动 HTTP 服务 → 打开默认浏览器。

use include_dir::{include_dir, Dir};
use std::io::{prelude::*, BufReader};
use std::net::{TcpListener, TcpStream};
use std::process::Command;

static WEB: Dir = include_dir!("$CARGO_MANIFEST_DIR/../web");

/// 1x1 PNG（mock 生成结果）
const MOCK_PNG: &str = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

fn mime_of(path: &str) -> &'static str {
    let ext = path.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        "html" | "htm" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "wasm" => "application/wasm",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() + 1 && i + 2 <= bytes.len() - 1 + 1 {
            if i + 2 < bytes.len() {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                if let (Some(h), Some(l)) = (hi, lo) {
                    out.push(((h << 4) | l) as u8);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn main() {
    // 端口探测 8123..8141
    let mut listener = None;
    let mut port = 0;
    for p in 8123..8141 {
        match TcpListener::bind(("127.0.0.1", p)) {
            Ok(l) => {
                listener = Some(l);
                port = p;
                break;
            }
            Err(_) => continue,
        }
    }
    let listener = match listener {
        Some(l) => l,
        None => {
            eprintln!("ERROR: no free port in 8123..8140");
            let _ = Command::new("cmd").args(["/c", "pause"]).status();
            return;
        }
    };
    let url = format!("http://127.0.0.1:{}", port);
    println!("==============================================");
    println!("  FrameForge Pixel Toolbox");
    println!("  Running at {}", url);
    println!("  Keep this window open. Ctrl+C to stop.");
    println!("==============================================");
    // 自动打开浏览器
    let _ = Command::new("cmd")
        .args(["/c", "start", "", &url])
        .spawn();

    for stream in listener.incoming() {
        match stream {
            Ok(s) => {
                std::thread::spawn(move || handle(s));
            }
            Err(_) => continue,
        }
    }
}

fn handle(stream: TcpStream) {
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    });
    let mut req_line = String::new();
    if reader.read_line(&mut req_line).is_err() {
        return;
    }
    // 读完请求头，按 Content-Length 读完 body（丢弃）
    let mut content_length = 0usize;
    loop {
        let mut l = String::new();
        if reader.read_line(&mut l).is_err() || l == "\r\n" || l.is_empty() {
            break;
        }
        let lower = l.to_ascii_lowercase();
        if let Some(v) = lower.strip_prefix("content-length:") {
            content_length = v.trim().parse().unwrap_or(0);
        }
    }
    if content_length > 0 {
        let mut sink = vec![0u8; content_length.min(8 * 1024 * 1024)];
        let _ = reader.read_exact(&mut sink);
    }

    let path = req_line.split_whitespace().nth(1).unwrap_or("/").to_string();
    let path = percent_decode(path.split('?').next().unwrap_or("/"));

    if path.starts_with("/mock/") {
        return respond_mock(stream, &path);
    }

    let serve = if path == "/" { "/index.html".to_string() } else { path };
    match WEB.get_file(serve.trim_start_matches('/')) {
        Some(file) => {
            let body = file.contents();
            let head = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
                mime_of(&serve),
                body.len()
            );
            let mut s = stream;
            let _ = s.write_all(head.as_bytes());
            let _ = s.write_all(body);
        }
        None => {
            let head = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
            let mut s = stream;
            let _ = s.write_all(head.as_bytes());
        }
    }
}

fn respond_mock(mut stream: TcpStream, path: &str) {
    let lower = path.to_ascii_lowercase();
    let body = if lower.contains(":generatecontent") {
        format!(
            "{{\"candidates\":[{{\"content\":{{\"parts\":[{{\"inlineData\":{{\"mimeType\":\"image/png\",\"data\":\"{}\"}}}}]}}}}]}}",
            MOCK_PNG
        )
    } else if lower.contains("/chat/completions") {
        let data_url = format!("data:image/png;base64,{}", MOCK_PNG);
        // 交替两种响应形态（markdown dataURI / message.images）
        format!(
            "{{\"choices\":[{{\"message\":{{\"role\":\"assistant\",\"content\":\"![gen]({0})\",\"images\":[{{\"image_url\":{{\"url\":\"{0}\"}}}}]}}}}]}}",
            data_url
        )
    } else if lower.contains("/images/") {
        format!("{{\"data\":[{{\"b64_json\":\"{}\"}}]}}", MOCK_PNG)
    } else {
        "{}".to_string()
    };
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body.as_bytes());
}
