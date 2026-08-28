//! grok.com 聊天窗：系统浏览器登录（Google 可用），再把会话 cookie 同步进 App。

use serde::Serialize;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

use crate::spawn_system_browser;

pub const GROK_CHAT_LABEL: &str = "grok-chat";
const GROK_WEB: &str = "https://grok.com/";

const SESSION_COOKIE_NAMES: &[&str] = &["sso", "sso-rw", "auth_token"];

pub fn is_external_auth_url(url: &Url) -> bool {
    let host = url.host_str().unwrap_or("").trim_start_matches("www.").to_ascii_lowercase();
    matches!(
        host.as_str(),
        "accounts.google.com"
            | "oauth2.googleapis.com"
            | "accounts.youtube.com"
            | "appleid.apple.com"
            | "login.microsoftonline.com"
            | "login.live.com"
            | "account.apple.com"
    ) || host.ends_with(".google.com") && (host.contains("account") || host.contains("oauth"))
}

fn session_cookie_domains(domain: &str) -> bool {
    let host = domain.trim_start_matches('.').to_ascii_lowercase();
    host == "grok.com"
        || host.ends_with(".grok.com")
        || host == "x.ai"
        || host.ends_with(".x.ai")
        || host == "x.com"
        || host.ends_with(".x.com")
}

fn webview_has_session(app: &tauri::AppHandle) -> bool {
    let Some(chat) = app.get_webview_window(GROK_CHAT_LABEL) else {
        return false;
    };
    let Ok(url) = GROK_WEB.parse() else {
        return false;
    };
    let Ok(cookies) = chat.cookies_for_url(url) else {
        return false;
    };
    cookies.iter().any(|cookie| SESSION_COOKIE_NAMES.contains(&cookie.name()))
}

fn take_browser(
    name: &str,
    result: rookie::Result<Vec<rookie::enums::Cookie>>,
    cookies: &mut Vec<rookie::enums::Cookie>,
    notes: &mut Vec<String>,
) {
    match result {
        Ok(list) => cookies.extend(list),
        Err(error) => notes.push(format!("{name}: {error}")),
    }
}

fn collect_browser_cookies() -> (Vec<rookie::enums::Cookie>, Vec<String>) {
    let domains = vec![
        "grok.com".into(),
        "x.ai".into(),
        "accounts.x.ai".into(),
        "x.com".into(),
    ];
    let mut cookies = Vec::new();
    let mut notes = Vec::new();
    take_browser("chrome", rookie::chrome(Some(domains.clone())), &mut cookies, &mut notes);
    take_browser("edge", rookie::edge(Some(domains.clone())), &mut cookies, &mut notes);
    take_browser("brave", rookie::brave(Some(domains.clone())), &mut cookies, &mut notes);
    take_browser("arc", rookie::arc(Some(domains.clone())), &mut cookies, &mut notes);
    take_browser("firefox", rookie::firefox(Some(domains.clone())), &mut cookies, &mut notes);
    take_browser("chromium", rookie::chromium(Some(domains.clone())), &mut cookies, &mut notes);
    #[cfg(target_os = "macos")]
    take_browser("safari", rookie::safari(Some(domains.clone())), &mut cookies, &mut notes);
    let cookies = cookies
        .into_iter()
        .filter(|cookie| session_cookie_domains(&cookie.domain))
        .collect();
    (cookies, notes)
}

fn to_webview_cookie(cookie: &rookie::enums::Cookie) -> cookie::Cookie<'static> {
    let mut next = cookie::Cookie::new(cookie.name.clone(), cookie.value.clone());
    if !cookie.domain.is_empty() {
        next.set_domain(cookie.domain.clone());
    }
    next.set_path(if cookie.path.is_empty() {
        "/".into()
    } else {
        cookie.path.clone()
    });
    next.set_secure(cookie.secure);
    next.set_http_only(cookie.http_only);
    next
}

#[tauri::command]
pub fn grok_chat_prepare(app: tauri::AppHandle) -> Result<(), String> {
    if app.get_webview_window(GROK_CHAT_LABEL).is_some() {
        return Ok(());
    }
    let parsed = GROK_WEB.parse::<Url>().map_err(|error| error.to_string())?;
    let handle = app.clone();
    WebviewWindowBuilder::new(&app, GROK_CHAT_LABEL, WebviewUrl::External(parsed))
        .title("Grok")
        .decorations(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .closable(false)
        .skip_taskbar(true)
        .shadow(false)
        .visible(false)
        .focused(false)
        .on_navigation(move |url| {
            if is_external_auth_url(url) {
                let _ = spawn_system_browser(url);
                let _ = handle.emit("grok-chat-external-auth", url.as_str());
                return false;
            }
            true
        })
        .build()
        .map_err(|error| format!("无法创建 grok.com 窗口：{error}"))?;
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokChatLoginStatus {
    pub logged_in: bool,
}

#[tauri::command]
pub fn grok_chat_login_status(app: tauri::AppHandle) -> Result<GrokChatLoginStatus, String> {
    let _ = grok_chat_prepare(app.clone());
    Ok(GrokChatLoginStatus {
        logged_in: webview_has_session(&app),
    })
}

#[tauri::command]
pub fn grok_chat_begin_browser_login() -> Result<(), String> {
    let parsed = GROK_WEB.parse::<Url>().map_err(|error| error.to_string())?;
    spawn_system_browser(&parsed)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokChatSyncResult {
    pub imported: usize,
    pub logged_in: bool,
    pub detail: String,
}

#[tauri::command]
pub fn grok_chat_sync_browser_session(app: tauri::AppHandle) -> Result<GrokChatSyncResult, String> {
    grok_chat_prepare(app.clone())?;
    let Some(chat) = app.get_webview_window(GROK_CHAT_LABEL) else {
        return Err("聊天窗口还不存在".into());
    };
    let (cookies, notes) = collect_browser_cookies();
    let mut imported = 0;
    let mut seen = std::collections::BTreeSet::new();
    for cookie in &cookies {
        let key = format!("{}|{}|{}", cookie.domain, cookie.path, cookie.name);
        if !seen.insert(key) {
            continue;
        }
        chat.set_cookie(to_webview_cookie(cookie))
            .map_err(|error| format!("写入登录 cookie 失败：{error}"))?;
        imported += 1;
    }
    let _ = chat.eval("location.replace('https://grok.com/')");
    let logged_in = webview_has_session(&app)
        || cookies.iter().any(|cookie| SESSION_COOKIE_NAMES.contains(&cookie.name.as_str()));
    let detail = if logged_in {
        format!("已从浏览器同步 {imported} 条 grok.com 登录信息")
    } else if imported == 0 {
        let extra = if notes.is_empty() {
            String::new()
        } else {
            format!("（{}）", notes.join("；"))
        };
        format!("浏览器里还没有 grok.com 登录态。请先在默认浏览器完成 Google 登录，再点同步{extra}")
    } else {
        format!("已写入 {imported} 条 cookie，但还没看到会话。请确认浏览器已打开 grok.com 并登录成功")
    };
    Ok(GrokChatSyncResult {
        imported,
        logged_in,
        detail,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn google_oauth_is_sent_to_system_browser() {
        let url = Url::parse("https://accounts.google.com/o/oauth2/v2/auth?client_id=x").unwrap();
        assert!(is_external_auth_url(&url));
    }

    #[test]
    fn grok_app_stays_in_webview() {
        let url = Url::parse("https://grok.com/chat").unwrap();
        assert!(!is_external_auth_url(&url));
    }

    #[test]
    fn session_domains_are_narrow() {
        assert!(session_cookie_domains(".grok.com"));
        assert!(session_cookie_domains("accounts.x.ai"));
        assert!(!session_cookie_domains("accounts.google.com"));
    }
}
