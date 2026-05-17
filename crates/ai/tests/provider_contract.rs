use std::{
    io::{Read, Write},
    net::TcpListener,
    sync::mpsc::{self, Receiver},
    thread::{self, JoinHandle},
    time::Duration,
};

use mindlattice_ai::provider::{
    build_llm_provider, LlmApiMode, LlmError, LlmProvider, LlmProviderConfig,
    LlmProviderId, LlmStructuredRequest, OpenAiCompatibleProvider,
};

#[test]
fn provider_config_requires_base_url_key_model_and_timeout() {
    let config = LlmProviderConfig {
        provider_id: LlmProviderId::OpenAi,
        api_mode: LlmApiMode::OpenAiChatCompletions,
        base_url: "https://api.example.test/v1".to_string(),
        api_key: "test-key".to_string(),
        model: "model-a".to_string(),
        timeout_seconds: 30,
    };

    config
        .validate()
        .expect("complete provider config is valid");

    let missing_key = LlmProviderConfig {
        api_key: String::new(),
        ..config
    };
    assert!(missing_key.validate().is_err());
}

#[test]
fn structured_request_records_prompt_version_and_schema() {
    let request = LlmStructuredRequest {
        prompt_version: "capture_messy_task@v1".to_string(),
        system_prompt: "policy".to_string(),
        user_prompt: "I have too much to do.".to_string(),
        output_schema: "agent_preview".to_string(),
        timeout_seconds: 20,
    };

    request.validate().expect("structured request is complete");
}

#[test]
fn openai_compatible_provider_posts_structured_chat_completion_request() {
    let response_body =
        r#"{"choices":[{"message":{"content":"{\"preview_id\":\"p1\"}"},"finish_reason":"stop"}]}"#;
    let (base_url, captured_request, server) = start_json_server("200 OK", response_body);
    let provider = OpenAiCompatibleProvider::new(LlmProviderConfig {
        provider_id: LlmProviderId::OpenAi,
        api_mode: LlmApiMode::OpenAiChatCompletions,
        base_url,
        api_key: "test-key".to_string(),
        model: "model-a".to_string(),
        timeout_seconds: 10,
    })
    .expect("complete provider config builds");

    let response = provider
        .complete_structured(LlmStructuredRequest {
            prompt_version: "capture_messy_task@v1".to_string(),
            system_prompt: "Follow the safety policy.".to_string(),
            user_prompt: "Break down the grant application.".to_string(),
            output_schema: r#"{"type":"object"}"#.to_string(),
            timeout_seconds: 5,
        })
        .expect("mock provider response is parsed");

    assert_eq!(response.content, r#"{"preview_id":"p1"}"#);
    assert_eq!(response.prompt_version, "capture_messy_task@v1");

    let request_text = captured_request
        .recv()
        .expect("server captures one provider request");
    server.join().expect("mock server exits");
    assert!(request_text.starts_with("POST /v1/chat/completions HTTP/1.1"));
    assert!(request_text
        .to_ascii_lowercase()
        .contains("authorization: bearer test-key"));
    assert!(request_text.contains(r#""model":"model-a""#));
    assert!(request_text.contains(r#""role":"system""#));
    assert!(request_text.contains("Follow the safety policy."));
    assert!(request_text.contains(r#""role":"user""#));
    assert!(request_text.contains("Break down the grant application."));
    assert!(request_text.contains(r#"{\"type\":\"object\"}"#));
    assert!(request_text.contains(r#""response_format":{"type":"json_object"}"#));
}

#[test]
fn provider_factory_dispatches_openai_responses_api_mode() {
    let response_body = r#"{"output":[{"content":[{"type":"output_text","text":"{\"preview_id\":\"p1\"}"}]}]}"#;
    let (base_url, captured_request, server) = start_json_server("200 OK", response_body);
    let provider = build_llm_provider(LlmProviderConfig {
        api_mode: LlmApiMode::OpenAiResponses,
        ..complete_config(base_url)
    })
    .expect("responses provider config builds");

    let response = provider
        .complete_structured(complete_request())
        .expect("responses payload is parsed");

    assert_eq!(response.content, r#"{"preview_id":"p1"}"#);
    let request_text = captured_request
        .recv()
        .expect("server captures responses request");
    server.join().expect("mock server exits");
    assert!(request_text.starts_with("POST /v1/responses HTTP/1.1"));
    assert!(request_text.contains(r#""model":"model-a""#));
    assert!(request_text.contains(r#""input":"#));
    assert!(request_text.contains(r#""text":{"format":{"type":"json_object"}}"#));
}

#[test]
fn provider_factory_dispatches_claude_messages_api_mode() {
    let response_body =
        r#"{"content":[{"type":"text","text":"{\"preview_id\":\"claude\"}"}]}"#;
    let (base_url, captured_request, server) = start_json_server("200 OK", response_body);
    let provider = build_llm_provider(LlmProviderConfig {
        provider_id: LlmProviderId::AnthropicClaude,
        api_mode: LlmApiMode::ClaudeMessages,
        ..complete_config(base_url)
    })
    .expect("claude provider config builds");

    let response = provider
        .complete_structured(complete_request())
        .expect("claude payload is parsed");

    assert_eq!(response.content, r#"{"preview_id":"claude"}"#);
    let request_text = captured_request
        .recv()
        .expect("server captures claude request");
    server.join().expect("mock server exits");
    assert!(request_text.starts_with("POST /v1/messages HTTP/1.1"));
    assert!(request_text
        .to_ascii_lowercase()
        .contains("x-api-key: test-key"));
    assert!(request_text
        .to_ascii_lowercase()
        .contains("anthropic-version: 2023-06-01"));
    assert!(request_text.contains(r#""system":"Follow the safety policy.""#));
    assert!(request_text.contains(r#""max_tokens":4096"#));
}

#[test]
fn provider_factory_dispatches_gemini_native_api_mode() {
    let response_body = r#"{"candidates":[{"content":{"parts":[{"text":"{\"preview_id\":\"gemini\"}"}]},"finishReason":"STOP"}]}"#;
    let (base_url, captured_request, server) = start_json_server("200 OK", response_body);
    let base_url = base_url.replace("/v1", "/v1beta");
    let provider = build_llm_provider(LlmProviderConfig {
        provider_id: LlmProviderId::GoogleGemini,
        api_mode: LlmApiMode::GeminiGenerateContent,
        ..complete_config(base_url)
    })
    .expect("gemini provider config builds");

    let response = provider
        .complete_structured(complete_request())
        .expect("gemini payload is parsed");

    assert_eq!(response.content, r#"{"preview_id":"gemini"}"#);
    let request_text = captured_request
        .recv()
        .expect("server captures gemini request");
    server.join().expect("mock server exits");
    assert!(request_text.starts_with("POST /v1beta/models/model-a:generateContent HTTP/1.1"));
    assert!(request_text
        .to_ascii_lowercase()
        .contains("x-goog-api-key: test-key"));
    assert!(request_text.contains(r#""responseMimeType":"application/json""#));
    assert!(request_text.contains("Break down the grant application."));
}

#[test]
fn openai_compatible_provider_maps_refusal_finish_reason() {
    let response_body =
        r#"{"choices":[{"message":{"content":""},"finish_reason":"content_filter"}]}"#;
    let (base_url, captured_request, server) = start_json_server("200 OK", response_body);
    let provider = OpenAiCompatibleProvider::new(complete_config(base_url))
        .expect("complete provider config builds");

    let error = provider
        .complete_structured(complete_request())
        .expect_err("content filter finish reason is a refusal");

    assert_eq!(error, LlmError::Refusal);
    captured_request
        .recv()
        .expect("server captures one provider request");
    server.join().expect("mock server exits");
}

#[test]
fn openai_compatible_provider_rejects_malformed_response_shape() {
    let (base_url, captured_request, server) = start_json_server("200 OK", r#"{"choices":[]}"#);
    let provider = OpenAiCompatibleProvider::new(complete_config(base_url))
        .expect("complete provider config builds");

    let error = provider
        .complete_structured(complete_request())
        .expect_err("missing choice content is malformed output");

    assert_eq!(error, LlmError::MalformedOutput);
    captured_request
        .recv()
        .expect("server captures one provider request");
    server.join().expect("mock server exits");
}

#[test]
fn openai_compatible_provider_maps_auth_status_to_missing_provider_settings() {
    let (base_url, captured_request, server) =
        start_json_server("401 Unauthorized", r#"{"error":{"message":"bad key"}}"#);
    let provider = OpenAiCompatibleProvider::new(complete_config(base_url))
        .expect("complete provider config builds");

    let error = provider
        .complete_structured(complete_request())
        .expect_err("provider auth failure is a configuration problem");

    assert_eq!(error, LlmError::ProviderNotConfigured);
    captured_request
        .recv()
        .expect("server captures one provider request");
    server.join().expect("mock server exits");
}

#[test]
fn openai_compatible_provider_enforces_request_timeout() {
    let (base_url, captured_request, server) = start_slow_json_server(
        r#"{"choices":[{"message":{"content":"{}"},"finish_reason":"stop"}]}"#,
    );
    let provider = OpenAiCompatibleProvider::new(complete_config(base_url))
        .expect("complete provider config builds");
    let request = LlmStructuredRequest {
        timeout_seconds: 1,
        ..complete_request()
    };

    let error = provider
        .complete_structured(request)
        .expect_err("request timeout overrides longer provider timeout");

    assert_eq!(error, LlmError::Timeout);
    captured_request
        .recv()
        .expect("server captures one provider request");
    server.join().expect("mock server exits");
}

fn complete_config(base_url: String) -> LlmProviderConfig {
    LlmProviderConfig {
        provider_id: LlmProviderId::OpenAi,
        api_mode: LlmApiMode::OpenAiChatCompletions,
        base_url,
        api_key: "test-key".to_string(),
        model: "model-a".to_string(),
        timeout_seconds: 10,
    }
}

fn complete_request() -> LlmStructuredRequest {
    LlmStructuredRequest {
        prompt_version: "capture_messy_task@v1".to_string(),
        system_prompt: "Follow the safety policy.".to_string(),
        user_prompt: "Break down the grant application.".to_string(),
        output_schema: r#"{"type":"object"}"#.to_string(),
        timeout_seconds: 5,
    }
}

fn start_json_server(
    status_line: &'static str,
    response_body: &'static str,
) -> (String, Receiver<String>, JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind local mock server");
    let address = listener
        .local_addr()
        .expect("read local mock server address");
    let base_url = format!("http://{address}/v1");
    let (sender, receiver) = mpsc::channel();

    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept provider request");
        let request_text = read_http_request(&mut stream);
        sender.send(request_text).expect("send captured request");

        let response = format!(
            "HTTP/1.1 {status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
            response_body.len()
        );
        stream
            .write_all(response.as_bytes())
            .expect("write mock response");
    });

    (base_url, receiver, handle)
}

fn start_slow_json_server(
    response_body: &'static str,
) -> (String, Receiver<String>, JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind local mock server");
    let address = listener
        .local_addr()
        .expect("read local mock server address");
    let base_url = format!("http://{address}/v1");
    let (sender, receiver) = mpsc::channel();

    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept provider request");
        let request_text = read_http_request(&mut stream);
        sender.send(request_text).expect("send captured request");
        thread::sleep(Duration::from_secs(2));

        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
            response_body.len()
        );
        let _ = stream.write_all(response.as_bytes());
    });

    (base_url, receiver, handle)
}

fn read_http_request(stream: &mut std::net::TcpStream) -> String {
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 1024];

    loop {
        let read = stream.read(&mut chunk).expect("read provider request");
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if request_is_complete(&buffer) {
            break;
        }
    }

    String::from_utf8_lossy(&buffer).to_string()
}

fn request_is_complete(buffer: &[u8]) -> bool {
    let Some(header_end) = buffer.windows(4).position(|window| window == b"\r\n\r\n") else {
        return false;
    };
    let headers = String::from_utf8_lossy(&buffer[..header_end]);
    let content_length = headers
        .lines()
        .find_map(|line| {
            line.strip_prefix("content-length: ")
                .or_else(|| line.strip_prefix("Content-Length: "))
                .and_then(|value| value.trim().parse::<usize>().ok())
        })
        .unwrap_or(0);
    buffer.len() >= header_end + 4 + content_length
}
