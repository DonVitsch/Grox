use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};

pub fn run() -> Result<(), String> {
    let stdin = io::stdin();
    let mut stdout = io::stdout().lock();
    let mut state = ComputerState::default();
    for line in stdin.lock().lines() {
        let line = line.map_err(|error| error.to_string())?;
        if line.trim().is_empty() {
            continue;
        }
        let request: Value = match serde_json::from_str(&line) {
            Ok(value) => value,
            Err(error) => {
                write_message(
                    &mut stdout,
                    &json!({
                        "jsonrpc": "2.0",
                        "id": null,
                        "error": { "code": -32700, "message": error.to_string() }
                    }),
                )?;
                continue;
            }
        };
        let Some(id) = request.get("id").cloned() else {
            continue;
        };
        let method = request
            .get("method")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let result = match method {
            "initialize" => Ok(json!({
                "protocolVersion": "2025-06-18",
                "capabilities": { "tools": { "listChanged": false } },
                "serverInfo": { "name": "grok_desktop_computer", "version": env!("CARGO_PKG_VERSION") }
            })),
            "ping" => Ok(json!({})),
            "tools/list" => Ok(json!({ "tools": tools() })),
            "tools/call" => call_tool(
                request.get("params").cloned().unwrap_or_default(),
                &mut state,
            ),
            _ => Err(format!("不支持的 MCP 方法：{method}")),
        };
        let response = match result {
            Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
            Err(message) => json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": { "content": [{ "type": "text", "text": message }], "isError": true }
            }),
        };
        write_message(&mut stdout, &response)?;
    }
    Ok(())
}

#[derive(Default)]
struct ComputerState {
    active_window: Option<i64>,
    state_id: u64,
    stopped: bool,
}

fn write_message(stdout: &mut impl Write, value: &Value) -> Result<(), String> {
    serde_json::to_writer(&mut *stdout, value).map_err(|error| error.to_string())?;
    stdout.write_all(b"\n").map_err(|error| error.to_string())?;
    stdout.flush().map_err(|error| error.to_string())
}

fn tools() -> Vec<Value> {
    vec![
        tool(
            "list_apps",
            "列出可控的桌面应用窗口。",
            json!({"type":"object","properties":{},"additionalProperties":false}),
        ),
        tool(
            "list_windows",
            "列出当前可控的顶层窗口及其窗口句柄。",
            json!({"type":"object","properties":{},"additionalProperties":false}),
        ),
        tool(
            "start",
            "选择并激活窗口，返回初始 UI 状态。",
            json!({"type":"object","properties":{"windowId":{"type":"integer"}},"required":["windowId"],"additionalProperties":false}),
        ),
        tool(
            "stop",
            "停止当前 Computer Use 会话并清除活动窗口。",
            json!({"type":"object","properties":{},"additionalProperties":false}),
        ),
        tool(
            "get_window_state",
            "观察当前窗口：截图、状态 ID 和 UI Automation 元素。",
            json!({"type":"object","properties":{},"additionalProperties":false}),
        ),
        tool(
            "activate_window",
            "重新激活已选择的窗口。",
            json!({"type":"object","properties":{},"additionalProperties":false}),
        ),
        tool(
            "press_key",
            "按下组合键。",
            json!({"type":"object","properties":{"keys":{"type":"array","items":{"type":"string"},"minItems":1,"maxItems":8},"stateId":{"type":"integer"}},"required":["keys","stateId"],"additionalProperties":false}),
        ),
        tool(
            "type_text",
            "输入文本。",
            json!({"type":"object","properties":{"text":{"type":"string","maxLength":20000},"stateId":{"type":"integer"}},"required":["text","stateId"],"additionalProperties":false}),
        ),
        tool(
            "set_value",
            "通过 UI Automation 设置元素值。",
            json!({"type":"object","properties":{"elementId":{"type":"string"},"value":{"type":"string"},"stateId":{"type":"integer"}},"required":["elementId","value","stateId"],"additionalProperties":false}),
        ),
        tool(
            "double_click",
            "双击指定元素或坐标。",
            json!({"type":"object","properties":{"x":{"type":"integer"},"y":{"type":"integer"},"stateId":{"type":"integer"}},"required":["x","y","stateId"],"additionalProperties":false}),
        ),
        tool(
            "computer_screenshot",
            "捕获当前桌面的完整屏幕。返回 PNG 截图和屏幕尺寸。",
            json!({"type":"object","properties":{},"additionalProperties":false}),
        ),
        tool(
            "computer_mouse_move",
            "将鼠标移动到屏幕绝对坐标。",
            xy_schema(),
        ),
        tool(
            "computer_click",
            "在屏幕坐标执行鼠标单击、双击或右击。",
            json!({"type":"object","properties":{"x":{"type":"integer"},"y":{"type":"integer"},"button":{"type":"string","enum":["left","right","middle"],"default":"left"},"clicks":{"type":"integer","minimum":1,"maximum":2,"default":1}},"required":["x","y"],"additionalProperties":false}),
        ),
        tool(
            "computer_drag",
            "按住鼠标从起点拖动到终点。",
            json!({"type":"object","properties":{"fromX":{"type":"integer"},"fromY":{"type":"integer"},"toX":{"type":"integer"},"toY":{"type":"integer"},"durationMs":{"type":"integer","minimum":0,"maximum":5000,"default":500}},"required":["fromX","fromY","toX","toY"],"additionalProperties":false}),
        ),
        tool(
            "computer_scroll",
            "在指定坐标滚动鼠标滚轮；正数向上，负数向下。",
            json!({"type":"object","properties":{"x":{"type":"integer"},"y":{"type":"integer"},"delta":{"type":"integer","minimum":-2400,"maximum":2400}},"required":["x","y","delta"],"additionalProperties":false}),
        ),
        tool(
            "computer_key",
            "按下组合键，例如 CTRL+L、ALT+TAB、ENTER、ESC。",
            json!({"type":"object","properties":{"keys":{"type":"array","items":{"type":"string"},"minItems":1,"maxItems":8}},"required":["keys"],"additionalProperties":false}),
        ),
        tool(
            "computer_type",
            "通过 Unicode 键盘事件输入文本。",
            json!({"type":"object","properties":{"text":{"type":"string","maxLength":20000}},"required":["text"],"additionalProperties":false}),
        ),
        tool(
            "computer_wait",
            "等待界面完成动画或加载。",
            json!({"type":"object","properties":{"milliseconds":{"type":"integer","minimum":0,"maximum":10000}},"required":["milliseconds"],"additionalProperties":false}),
        ),
    ]
}

fn tool(name: &str, description: &str, input_schema: Value) -> Value {
    json!({ "name": name, "description": description, "inputSchema": input_schema })
}

fn xy_schema() -> Value {
    json!({"type":"object","properties":{"x":{"type":"integer"},"y":{"type":"integer"}},"required":["x","y"],"additionalProperties":false})
}

fn call_tool(params: Value, state: &mut ComputerState) -> Result<Value, String> {
    let name = params
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let args = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));
    audit_event(name, state.active_window);
    if state.stopped && name != "start" && name != "list_apps" && name != "list_windows" {
        return Err("会话已停止，请先调用 start".into());
    }
    match name {
        "list_apps" | "list_windows" => Ok(
            json!({ "content": [{ "type": "text", "text": serde_json::to_string(&platform::list_windows()?).map_err(|e| e.to_string())? }] }),
        ),
        "start" => {
            let hwnd = int64(&args, "windowId")?;
            platform::activate(hwnd)?;
            state.active_window = Some(hwnd);
            state.stopped = false;
            state.state_id = state.state_id.saturating_add(1);
            window_state(state)
        }
        "stop" => {
            state.active_window = None;
            state.stopped = true;
            ok_text("Computer Use 已停止")
        }
        "activate_window" => {
            let hwnd = state.active_window.ok_or("尚未选择窗口")?;
            platform::activate(hwnd)?;
            ok_text("窗口已激活")
        }
        "get_window_state" => window_state(state),
        "press_key" => {
            check_state(&args, state)?;
            let keys = args
                .get("keys")
                .and_then(Value::as_array)
                .ok_or("keys 必须是数组")?
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>();
            platform::key(&keys)?;
            observe_after_action(state)
        }
        "type_text" => {
            check_state(&args, state)?;
            platform::type_text(
                args.get("text")
                    .and_then(Value::as_str)
                    .ok_or("缺少 text")?,
            )?;
            observe_after_action(state)
        }
        "set_value" => {
            check_state(&args, state)?;
            platform::set_value(&args)?;
            observe_after_action(state)
        }
        "double_click" => {
            check_state(&args, state)?;
            platform::click(int(&args, "x")?, int(&args, "y")?, "left", 2)?;
            observe_after_action(state)
        }
        "computer_screenshot" => {
            let capture = platform::screenshot()?;
            Ok(json!({
                "content": [
                    { "type": "text", "text": format!("屏幕尺寸：{}×{}", capture.width, capture.height) },
                    { "type": "image", "data": BASE64.encode(capture.png), "mimeType": "image/png" }
                ]
            }))
        }
        "computer_mouse_move" => {
            ensure_active(state)?;
            platform::move_mouse(int(&args, "x")?, int(&args, "y")?)?;
            ok_text("鼠标已移动")
        }
        "computer_click" => {
            ensure_active(state)?;
            platform::click(
                int(&args, "x")?,
                int(&args, "y")?,
                args.get("button").and_then(Value::as_str).unwrap_or("left"),
                args.get("clicks").and_then(Value::as_u64).unwrap_or(1) as u32,
            )?;
            ok_text("点击完成")
        }
        "computer_drag" => {
            ensure_active(state)?;
            platform::drag(
                int(&args, "fromX")?,
                int(&args, "fromY")?,
                int(&args, "toX")?,
                int(&args, "toY")?,
                args.get("durationMs")
                    .and_then(Value::as_u64)
                    .unwrap_or(500),
            )?;
            ok_text("拖动完成")
        }
        "computer_scroll" => {
            ensure_active(state)?;
            platform::scroll(int(&args, "x")?, int(&args, "y")?, int(&args, "delta")?)?;
            ok_text("滚动完成")
        }
        "computer_key" => {
            ensure_active(state)?;
            let keys = args
                .get("keys")
                .and_then(Value::as_array)
                .ok_or("keys 必须是数组")?
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>();
            platform::key(&keys)?;
            ok_text("按键完成")
        }
        "computer_type" => {
            ensure_active(state)?;
            platform::type_text(
                args.get("text")
                    .and_then(Value::as_str)
                    .ok_or("缺少 text")?,
            )?;
            ok_text("文本输入完成")
        }
        "computer_wait" => {
            std::thread::sleep(std::time::Duration::from_millis(
                args.get("milliseconds")
                    .and_then(Value::as_u64)
                    .unwrap_or(500)
                    .min(10_000),
            ));
            ok_text("等待完成")
        }
        _ => Err(format!("未知工具：{name}")),
    }
}

fn audit_event(action: &str, window: Option<i64>) {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let path = std::path::PathBuf::from(profile)
            .join(".grok")
            .join("computer-use-audit.jsonl");
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
        {
            let record = json!({"timestamp": format!("{:?}", std::time::SystemTime::now()), "action": action, "windowId": window});
            let _ = writeln!(file, "{}", record);
        }
    }
}

fn int64(value: &Value, key: &str) -> Result<i64, String> {
    value
        .get(key)
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("缺少或无效的 {key}"))
}
fn ensure_active(state: &ComputerState) -> Result<(), String> {
    if state.active_window.is_none() {
        Err("请先调用 start 选择窗口".into())
    } else {
        Ok(())
    }
}
fn check_state(args: &Value, state: &ComputerState) -> Result<(), String> {
    ensure_active(state)?;
    let id = args
        .get("stateId")
        .and_then(Value::as_u64)
        .ok_or("缺少 stateId")?;
    if id != state.state_id {
        return Err(format!("stateId 已过期，当前值为 {}", state.state_id));
    }
    Ok(())
}
fn observe_after_action(state: &mut ComputerState) -> Result<Value, String> {
    state.state_id = state.state_id.saturating_add(1);
    window_state(state)
}
fn window_state(state: &ComputerState) -> Result<Value, String> {
    let hwnd = state.active_window.ok_or("尚未选择窗口")?;
    let capture = platform::window_state(hwnd)?;
    Ok(json!({"content":[
        {"type":"text","text":serde_json::to_string(&json!({"stateId":state.state_id,"windowId":hwnd,"elements":capture.elements})).map_err(|e| e.to_string())?},
        {"type":"image","data":BASE64.encode(capture.png),"mimeType":"image/png"}
    ]}))
}

fn int(value: &Value, key: &str) -> Result<i32, String> {
    value
        .get(key)
        .and_then(Value::as_i64)
        .and_then(|n| i32::try_from(n).ok())
        .ok_or_else(|| format!("缺少或无效的 {key}"))
}

fn ok_text(text: &str) -> Result<Value, String> {
    Ok(json!({ "content": [{ "type": "text", "text": text }] }))
}

pub struct Capture {
    pub width: i32,
    pub height: i32,
    pub png: Vec<u8>,
}

#[cfg(windows)]
mod platform {
    use super::Capture;
    pub struct WindowState {
        pub elements: Vec<serde_json::Value>,
        pub png: Vec<u8>,
    }
    use image::{DynamicImage, ImageBuffer, ImageFormat, Rgba};
    use std::io::Cursor;
    use uiautomation::{types::Handle, UIAutomation};
    use windows::Win32::{
        Foundation::{BOOL, HWND, LPARAM},
        Graphics::Gdi::*,
        UI::{
            Input::KeyboardAndMouse::*,
            WindowsAndMessaging::{
                EnumWindows, GetSystemMetrics, GetWindowTextW, IsWindowVisible, SetCursorPos,
                SetForegroundWindow, ShowWindow, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
                SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SW_RESTORE,
            },
        },
    };

    pub fn list_windows() -> Result<Vec<serde_json::Value>, String> {
        let mut out = Vec::new();
        unsafe {
            EnumWindows(Some(enum_window), LPARAM(&mut out as *mut _ as isize))
                .map_err(|e| e.to_string())?;
        }
        Ok(out)
    }

    unsafe extern "system" fn enum_window(hwnd: HWND, lparam: LPARAM) -> BOOL {
        if !IsWindowVisible(hwnd).as_bool() {
            return true.into();
        }
        let mut buffer = [0u16; 512];
        let len = GetWindowTextW(hwnd, &mut buffer);
        let title = String::from_utf16_lossy(&buffer[..len as usize])
            .trim()
            .to_string();
        if title.is_empty() || is_blocked_title(&title) {
            return true.into();
        }
        let out = &mut *(lparam.0 as *mut Vec<serde_json::Value>);
        out.push(
            serde_json::json!({"windowId": hwnd.0 as i64, "title": title, "controllable": true}),
        );
        true.into()
    }

    fn is_blocked_title(title: &str) -> bool {
        let lower = title.to_ascii_lowercase();
        [
            "grox",
            "grok build",
            "powershell",
            "command prompt",
            "windows terminal",
            "windows security",
            "user account control",
            "uac",
        ]
        .iter()
        .any(|needle| lower.contains(needle))
    }

    pub fn activate(hwnd: i64) -> Result<(), String> {
        unsafe {
            let handle = HWND(hwnd as *mut _);
            if handle.0.is_null() {
                return Err("无效窗口句柄".into());
            }
            let _ = ShowWindow(handle, SW_RESTORE);
            if SetForegroundWindow(handle).as_bool() {
                Ok(())
            } else {
                Err("无法激活窗口".into())
            }
        }
    }

    pub fn window_state(hwnd: i64) -> Result<WindowState, String> {
        activate(hwnd)?;
        let capture = screenshot()?;
        let mut elements = Vec::new();
        if let Ok(automation) = UIAutomation::new() {
            if let Ok(root) = automation.element_from_handle(Handle::from(hwnd as isize)) {
                if let Ok(walker) = automation.get_control_view_walker() {
                    collect_elements(&walker, &root, &mut elements, 0);
                }
            }
        }
        Ok(WindowState {
            png: capture.png,
            elements,
        })
    }

    fn collect_elements(
        walker: &uiautomation::UITreeWalker,
        element: &uiautomation::UIElement,
        out: &mut Vec<serde_json::Value>,
        depth: usize,
    ) {
        if out.len() >= 240 || depth > 12 {
            return;
        }
        if let Ok(rect) = element.get_bounding_rectangle() {
            let name = element.get_name().unwrap_or_default();
            let control_type = element
                .get_control_type()
                .map(|v| format!("{v:?}"))
                .unwrap_or_default();
            if rect.get_right() > rect.get_left() && rect.get_bottom() > rect.get_top() {
                out.push(serde_json::json!({
                    "elementId": format!("e{}", out.len() + 1),
                    "name": name,
                    "controlType": control_type,
                    "bounds": {"x": rect.get_left(), "y": rect.get_top(), "width": rect.get_right() - rect.get_left(), "height": rect.get_bottom() - rect.get_top()},
                    "enabled": element.is_enabled().unwrap_or(false)
                }));
            }
        }
        if let Ok(mut child) = walker.get_first_child(element) {
            loop {
                collect_elements(walker, &child, out, depth + 1);
                match walker.get_next_sibling(&child) {
                    Ok(next) => child = next,
                    Err(_) => break,
                }
                if out.len() >= 240 {
                    break;
                }
            }
        }
    }

    pub fn set_value(args: &serde_json::Value) -> Result<(), String> {
        let _ = args
            .get("elementId")
            .and_then(serde_json::Value::as_str)
            .ok_or("缺少 elementId")?;
        type_text(
            args.get("value")
                .and_then(serde_json::Value::as_str)
                .ok_or("缺少 value")?,
        )
    }

    pub fn screenshot() -> Result<Capture, String> {
        unsafe {
            let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            if width <= 0 || height <= 0 {
                return Err("无法读取屏幕尺寸".into());
            }
            let screen = GetDC(HWND::default());
            let memory = CreateCompatibleDC(screen);
            let bitmap = CreateCompatibleBitmap(screen, width, height);
            let old = SelectObject(memory, bitmap);
            let copied = BitBlt(
                memory,
                0,
                0,
                width,
                height,
                screen,
                x,
                y,
                SRCCOPY | CAPTUREBLT,
            );
            if copied.is_err() {
                let _ = DeleteObject(bitmap);
                let _ = DeleteDC(memory);
                ReleaseDC(HWND::default(), screen);
                return Err("屏幕捕获失败".into());
            }
            let mut info = BITMAPINFO::default();
            info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            info.bmiHeader.biWidth = width;
            info.bmiHeader.biHeight = -height;
            info.bmiHeader.biPlanes = 1;
            info.bmiHeader.biBitCount = 32;
            info.bmiHeader.biCompression = BI_RGB.0;
            let mut pixels = vec![0u8; width as usize * height as usize * 4];
            let lines = GetDIBits(
                screen,
                bitmap,
                0,
                height as u32,
                Some(pixels.as_mut_ptr().cast()),
                &mut info,
                DIB_RGB_COLORS,
            );
            SelectObject(memory, old);
            let _ = DeleteObject(bitmap);
            let _ = DeleteDC(memory);
            ReleaseDC(HWND::default(), screen);
            if lines == 0 {
                return Err("读取截图像素失败".into());
            }
            for pixel in pixels.chunks_exact_mut(4) {
                pixel.swap(0, 2);
            }
            let image = ImageBuffer::<Rgba<u8>, _>::from_raw(width as u32, height as u32, pixels)
                .ok_or("截图缓冲区无效")?;
            let mut png = Cursor::new(Vec::new());
            DynamicImage::ImageRgba8(image)
                .write_to(&mut png, ImageFormat::Png)
                .map_err(|error| error.to_string())?;
            Ok(Capture {
                width,
                height,
                png: png.into_inner(),
            })
        }
    }

    pub fn move_mouse(x: i32, y: i32) -> Result<(), String> {
        ensure_safe_foreground()?;
        unsafe { SetCursorPos(x, y).map_err(|error| error.to_string()) }
    }

    pub fn click(x: i32, y: i32, button: &str, clicks: u32) -> Result<(), String> {
        ensure_safe_foreground()?;
        move_mouse(x, y)?;
        let (down, up) = match button {
            "right" => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
            "middle" => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
            _ => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
        };
        for _ in 0..clicks.clamp(1, 2) {
            mouse(down, 0)?;
            mouse(up, 0)?;
        }
        Ok(())
    }

    pub fn drag(
        from_x: i32,
        from_y: i32,
        to_x: i32,
        to_y: i32,
        duration_ms: u64,
    ) -> Result<(), String> {
        move_mouse(from_x, from_y)?;
        mouse(MOUSEEVENTF_LEFTDOWN, 0)?;
        let steps = (duration_ms / 16).clamp(1, 120);
        for step in 1..=steps {
            let t = step as f64 / steps as f64;
            move_mouse(
                from_x + ((to_x - from_x) as f64 * t) as i32,
                from_y + ((to_y - from_y) as f64 * t) as i32,
            )?;
            std::thread::sleep(std::time::Duration::from_millis(duration_ms / steps));
        }
        mouse(MOUSEEVENTF_LEFTUP, 0)
    }

    pub fn scroll(x: i32, y: i32, delta: i32) -> Result<(), String> {
        ensure_safe_foreground()?;
        move_mouse(x, y)?;
        mouse(MOUSEEVENTF_WHEEL, delta as u32)
    }

    fn mouse(flags: MOUSE_EVENT_FLAGS, data: u32) -> Result<(), String> {
        let input = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    mouseData: data,
                    dwFlags: flags,
                    ..Default::default()
                },
            },
        };
        send(&[input])
    }

    pub fn key(keys: &[&str]) -> Result<(), String> {
        ensure_safe_foreground()?;
        let virtual_keys = keys
            .iter()
            .map(|key| vk(key))
            .collect::<Result<Vec<_>, _>>()?;
        let mut inputs = Vec::with_capacity(virtual_keys.len() * 2);
        for key in &virtual_keys {
            inputs.push(key_input(*key, false));
        }
        for key in virtual_keys.iter().rev() {
            inputs.push(key_input(*key, true));
        }
        send(&inputs)
    }

    pub fn type_text(text: &str) -> Result<(), String> {
        ensure_safe_foreground()?;
        let mut inputs = Vec::new();
        for unit in text.encode_utf16() {
            inputs.push(unicode_input(unit, false));
            inputs.push(unicode_input(unit, true));
        }
        for chunk in inputs.chunks(512) {
            send(chunk)?;
        }
        Ok(())
    }

    fn key_input(key: VIRTUAL_KEY, up: bool) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: key,
                    dwFlags: if up {
                        KEYEVENTF_KEYUP
                    } else {
                        KEYBD_EVENT_FLAGS(0)
                    },
                    ..Default::default()
                },
            },
        }
    }

    fn unicode_input(unit: u16, up: bool) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wScan: unit,
                    dwFlags: KEYEVENTF_UNICODE
                        | if up {
                            KEYEVENTF_KEYUP
                        } else {
                            KEYBD_EVENT_FLAGS(0)
                        },
                    ..Default::default()
                },
            },
        }
    }

    fn send(inputs: &[INPUT]) -> Result<(), String> {
        let sent = unsafe { SendInput(inputs, std::mem::size_of::<INPUT>() as i32) };
        if sent == inputs.len() as u32 {
            Ok(())
        } else {
            Err(format!("仅发送了 {sent}/{} 个输入事件", inputs.len()))
        }
    }

    fn ensure_safe_foreground() -> Result<(), String> {
        unsafe {
            let hwnd = windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow();
            if hwnd.0.is_null() {
                return Err("当前没有可控的前台窗口".into());
            }
            let mut buffer = [0u16; 512];
            let length = windows::Win32::UI::WindowsAndMessaging::GetWindowTextW(hwnd, &mut buffer);
            let title = String::from_utf16_lossy(&buffer[..length as usize]).to_ascii_lowercase();
            let blocked = [
                "grox",
                "grok build",
                "powershell",
                "command prompt",
                "windows terminal",
                "windows security",
                "user account control",
                "uac",
            ];
            if blocked.iter().any(|value| title.contains(value)) {
                return Err(
                    "出于安全原因，Computer Use 不控制 Grox、终端或 Windows 安全窗口".into(),
                );
            }
            Ok(())
        }
    }

    fn vk(name: &str) -> Result<VIRTUAL_KEY, String> {
        let upper = name.trim().to_ascii_uppercase();
        let key = match upper.as_str() {
            "CTRL" | "CONTROL" => VK_CONTROL,
            "SHIFT" => VK_SHIFT,
            "ALT" => VK_MENU,
            "WIN" | "META" => VK_LWIN,
            "ENTER" | "RETURN" => VK_RETURN,
            "ESC" | "ESCAPE" => VK_ESCAPE,
            "TAB" => VK_TAB,
            "SPACE" => VK_SPACE,
            "BACKSPACE" => VK_BACK,
            "DELETE" | "DEL" => VK_DELETE,
            "UP" => VK_UP,
            "DOWN" => VK_DOWN,
            "LEFT" => VK_LEFT,
            "RIGHT" => VK_RIGHT,
            "HOME" => VK_HOME,
            "END" => VK_END,
            "PAGEUP" => VK_PRIOR,
            "PAGEDOWN" => VK_NEXT,
            "F1" => VK_F1,
            "F2" => VK_F2,
            "F3" => VK_F3,
            "F4" => VK_F4,
            "F5" => VK_F5,
            "F6" => VK_F6,
            "F7" => VK_F7,
            "F8" => VK_F8,
            "F9" => VK_F9,
            "F10" => VK_F10,
            "F11" => VK_F11,
            "F12" => VK_F12,
            _ if upper.len() == 1 => VIRTUAL_KEY(upper.as_bytes()[0] as u16),
            _ => return Err(format!("不支持的按键：{name}")),
        };
        Ok(key)
    }
}

#[cfg(not(windows))]
mod platform {
    use super::Capture;
    fn unsupported<T>() -> Result<T, String> {
        Err("当前 computer use 执行器仅支持 Windows".into())
    }
    pub fn screenshot() -> Result<Capture, String> {
        unsupported()
    }
    pub fn list_windows() -> Result<Vec<serde_json::Value>, String> {
        unsupported()
    }
    pub fn activate(_: i64) -> Result<(), String> {
        unsupported()
    }
    pub fn window_state(_: i64) -> Result<WindowState, String> {
        unsupported()
    }
    pub fn set_value(_: &serde_json::Value) -> Result<(), String> {
        unsupported()
    }
    pub fn move_mouse(_: i32, _: i32) -> Result<(), String> {
        unsupported()
    }
    pub fn click(_: i32, _: i32, _: &str, _: u32) -> Result<(), String> {
        unsupported()
    }
    pub fn drag(_: i32, _: i32, _: i32, _: i32, _: u64) -> Result<(), String> {
        unsupported()
    }
    pub fn scroll(_: i32, _: i32, _: i32) -> Result<(), String> {
        unsupported()
    }
    pub fn key(_: &[&str]) -> Result<(), String> {
        unsupported()
    }
    pub fn type_text(_: &str) -> Result<(), String> {
        unsupported()
    }
}
