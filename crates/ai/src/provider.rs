use std::time::Duration;

use reqwest::{blocking::Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LlmProviderId {
    OpenAi,
    AnthropicClaude,
    GoogleGemini,
    OllamaLocal,
    Custom,
}

impl LlmProviderId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OpenAi => "openai",
            Self::AnthropicClaude => "anthropic_claude",
            Self::GoogleGemini => "google_gemini",
            Self::OllamaLocal => "ollama_local",
            Self::Custom => "custom",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "openai" => Some(Self::OpenAi),
            "anthropic_claude" => Some(Self::AnthropicClaude),
            "google_gemini" => Some(Self::GoogleGemini),
            "ollama_local" => Some(Self::OllamaLocal),
            "custom" => Some(Self::Custom),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LlmApiMode {
    OpenAiChatCompletions,
    OpenAiResponses,
    ClaudeMessages,
    GeminiGenerateContent,
}

impl LlmApiMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OpenAiChatCompletions => "openai_chat_completions",
            Self::OpenAiResponses => "openai_responses",
            Self::ClaudeMessages => "claude_messages",
            Self::GeminiGenerateContent => "gemini_generate_content",
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "openai_chat_completions" => Some(Self::OpenAiChatCompletions),
            "openai_responses" => Some(Self::OpenAiResponses),
            "claude_messages" => Some(Self::ClaudeMessages),
            "gemini_generate_content" => Some(Self::GeminiGenerateContent),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LlmProviderConfig {
    pub provider_id: LlmProviderId,
    pub api_mode: LlmApiMode,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub timeout_seconds: u64,
}

impl LlmProviderConfig {
    pub fn validate(&self) -> Result<(), LlmConfigError> {
        if self.base_url.trim().is_empty() {
            return Err(LlmConfigError::MissingBaseUrl);
        }
        if self.api_key.trim().is_empty() {
            return Err(LlmConfigError::MissingApiKey);
        }
        if self.model.trim().is_empty() {
            return Err(LlmConfigError::MissingModel);
        }
        if self.timeout_seconds == 0 {
            return Err(LlmConfigError::InvalidTimeout);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LlmConfigError {
    MissingBaseUrl,
    MissingApiKey,
    MissingModel,
    InvalidTimeout,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LlmStructuredRequest {
    pub prompt_version: String,
    pub system_prompt: String,
    pub user_prompt: String,
    pub output_schema: String,
    pub timeout_seconds: u64,
}

impl LlmStructuredRequest {
    pub fn validate(&self) -> Result<(), LlmRequestError> {
        if self.prompt_version.trim().is_empty() {
            return Err(LlmRequestError::MissingPromptVersion);
        }
        if self.system_prompt.trim().is_empty() {
            return Err(LlmRequestError::MissingSystemPrompt);
        }
        if self.user_prompt.trim().is_empty() {
            return Err(LlmRequestError::MissingUserPrompt);
        }
        if self.output_schema.trim().is_empty() {
            return Err(LlmRequestError::MissingOutputSchema);
        }
        if self.timeout_seconds == 0 {
            return Err(LlmRequestError::InvalidTimeout);
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LlmStructuredResponse {
    pub content: String,
    pub prompt_version: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LlmRequestError {
    MissingPromptVersion,
    MissingSystemPrompt,
    MissingUserPrompt,
    MissingOutputSchema,
    InvalidTimeout,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LlmError {
    ProviderNotConfigured,
    Timeout,
    MalformedOutput,
    Refusal,
}

pub trait LlmProvider {
    fn complete_structured(
        &self,
        request: LlmStructuredRequest,
    ) -> Result<LlmStructuredResponse, LlmError>;
}

impl<T> LlmProvider for Box<T>
where
    T: LlmProvider + ?Sized,
{
    fn complete_structured(
        &self,
        request: LlmStructuredRequest,
    ) -> Result<LlmStructuredResponse, LlmError> {
        (**self).complete_structured(request)
    }
}

pub fn build_llm_provider(
    config: LlmProviderConfig,
) -> Result<Box<dyn LlmProvider + Send + Sync>, LlmConfigError> {
    match config.api_mode {
        LlmApiMode::OpenAiChatCompletions => Ok(Box::new(OpenAiCompatibleProvider::new(config)?)),
        LlmApiMode::OpenAiResponses => Ok(Box::new(OpenAiResponsesProvider::new(config)?)),
        LlmApiMode::ClaudeMessages => Ok(Box::new(ClaudeMessagesProvider::new(config)?)),
        LlmApiMode::GeminiGenerateContent => {
            Ok(Box::new(GeminiGenerateContentProvider::new(config)?))
        }
    }
}

#[derive(Clone, Debug)]
pub struct OpenAiCompatibleProvider {
    config: LlmProviderConfig,
    client: Client,
}

impl OpenAiCompatibleProvider {
    pub fn new(config: LlmProviderConfig) -> Result<Self, LlmConfigError> {
        build_client_provider(config)
    }

    fn chat_completions_url(&self) -> String {
        format!(
            "{}/chat/completions",
            self.config.base_url.trim_end_matches('/')
        )
    }
}

impl LlmProvider for OpenAiCompatibleProvider {
    fn complete_structured(
        &self,
        request: LlmStructuredRequest,
    ) -> Result<LlmStructuredResponse, LlmError> {
        request.validate().map_err(|_| LlmError::MalformedOutput)?;

        let prompt_version = request.prompt_version.clone();
        let body = OpenAiChatCompletionRequest::from_parts(&self.config.model, &request);
        let response = self
            .client
            .post(self.chat_completions_url())
            .bearer_auth(&self.config.api_key)
            .timeout(Duration::from_secs(request.timeout_seconds))
            .json(&body)
            .send()
            .map_err(map_transport_error)?;

        map_http_status(response.status())?;

        let response_body = response
            .json::<OpenAiChatCompletionResponse>()
            .map_err(|_| LlmError::MalformedOutput)?;
        let choice = response_body
            .choices
            .into_iter()
            .next()
            .ok_or(LlmError::MalformedOutput)?;
        if matches!(
            choice.finish_reason.as_deref(),
            Some("content_filter" | "refusal")
        ) {
            return Err(LlmError::Refusal);
        }

        let content = choice.message.content.ok_or(LlmError::MalformedOutput)?;
        non_empty_response(content, prompt_version)
    }
}

#[derive(Clone, Debug)]
pub struct OpenAiResponsesProvider {
    config: LlmProviderConfig,
    client: Client,
}

impl OpenAiResponsesProvider {
    pub fn new(config: LlmProviderConfig) -> Result<Self, LlmConfigError> {
        build_client_provider(config)
    }

    fn responses_url(&self) -> String {
        format!("{}/responses", self.config.base_url.trim_end_matches('/'))
    }
}

impl LlmProvider for OpenAiResponsesProvider {
    fn complete_structured(
        &self,
        request: LlmStructuredRequest,
    ) -> Result<LlmStructuredResponse, LlmError> {
        request.validate().map_err(|_| LlmError::MalformedOutput)?;

        let prompt_version = request.prompt_version.clone();
        let body = OpenAiResponsesRequest::from_parts(&self.config.model, &request);
        let response = self
            .client
            .post(self.responses_url())
            .bearer_auth(&self.config.api_key)
            .timeout(Duration::from_secs(request.timeout_seconds))
            .json(&body)
            .send()
            .map_err(map_transport_error)?;

        map_http_status(response.status())?;

        let response_body = response
            .json::<OpenAiResponsesResponse>()
            .map_err(|_| LlmError::MalformedOutput)?;
        non_empty_response(response_body.output_text(), prompt_version)
    }
}

#[derive(Clone, Debug)]
pub struct ClaudeMessagesProvider {
    config: LlmProviderConfig,
    client: Client,
}

impl ClaudeMessagesProvider {
    pub fn new(config: LlmProviderConfig) -> Result<Self, LlmConfigError> {
        build_client_provider(config)
    }

    fn messages_url(&self) -> String {
        format!("{}/messages", self.config.base_url.trim_end_matches('/'))
    }
}

impl LlmProvider for ClaudeMessagesProvider {
    fn complete_structured(
        &self,
        request: LlmStructuredRequest,
    ) -> Result<LlmStructuredResponse, LlmError> {
        request.validate().map_err(|_| LlmError::MalformedOutput)?;

        let prompt_version = request.prompt_version.clone();
        let body = ClaudeMessagesRequest::from_parts(&self.config.model, &request);
        let response = self
            .client
            .post(self.messages_url())
            .header("x-api-key", &self.config.api_key)
            .header("anthropic-version", "2023-06-01")
            .timeout(Duration::from_secs(request.timeout_seconds))
            .json(&body)
            .send()
            .map_err(map_transport_error)?;

        map_http_status(response.status())?;

        let response_body = response
            .json::<ClaudeMessagesResponse>()
            .map_err(|_| LlmError::MalformedOutput)?;
        non_empty_response(response_body.output_text(), prompt_version)
    }
}

#[derive(Clone, Debug)]
pub struct GeminiGenerateContentProvider {
    config: LlmProviderConfig,
    client: Client,
}

impl GeminiGenerateContentProvider {
    pub fn new(config: LlmProviderConfig) -> Result<Self, LlmConfigError> {
        build_client_provider(config)
    }

    fn generate_content_url(&self) -> String {
        format!(
            "{}/models/{}:generateContent",
            self.config.base_url.trim_end_matches('/'),
            self.config.model
        )
    }
}

impl LlmProvider for GeminiGenerateContentProvider {
    fn complete_structured(
        &self,
        request: LlmStructuredRequest,
    ) -> Result<LlmStructuredResponse, LlmError> {
        request.validate().map_err(|_| LlmError::MalformedOutput)?;

        let prompt_version = request.prompt_version.clone();
        let body = GeminiGenerateContentRequest::from_request(&request);
        let response = self
            .client
            .post(self.generate_content_url())
            .header("x-goog-api-key", &self.config.api_key)
            .timeout(Duration::from_secs(request.timeout_seconds))
            .json(&body)
            .send()
            .map_err(map_transport_error)?;

        map_http_status(response.status())?;

        let response_body = response
            .json::<GeminiGenerateContentResponse>()
            .map_err(|_| LlmError::MalformedOutput)?;
        if response_body.candidates.iter().any(|candidate| {
            matches!(
                candidate.finish_reason.as_deref(),
                Some("SAFETY" | "RECITATION")
            )
        }) {
            return Err(LlmError::Refusal);
        }
        non_empty_response(response_body.output_text(), prompt_version)
    }
}

fn build_client_provider<T>(config: LlmProviderConfig) -> Result<T, LlmConfigError>
where
    T: From<(LlmProviderConfig, Client)>,
{
    config.validate()?;
    let client = Client::builder()
        .timeout(Duration::from_secs(config.timeout_seconds))
        .build()
        .map_err(|_| LlmConfigError::InvalidTimeout)?;
    Ok(T::from((config, client)))
}

impl From<(LlmProviderConfig, Client)> for OpenAiCompatibleProvider {
    fn from((config, client): (LlmProviderConfig, Client)) -> Self {
        Self { config, client }
    }
}

impl From<(LlmProviderConfig, Client)> for OpenAiResponsesProvider {
    fn from((config, client): (LlmProviderConfig, Client)) -> Self {
        Self { config, client }
    }
}

impl From<(LlmProviderConfig, Client)> for ClaudeMessagesProvider {
    fn from((config, client): (LlmProviderConfig, Client)) -> Self {
        Self { config, client }
    }
}

impl From<(LlmProviderConfig, Client)> for GeminiGenerateContentProvider {
    fn from((config, client): (LlmProviderConfig, Client)) -> Self {
        Self { config, client }
    }
}

#[derive(Debug, Serialize)]
struct OpenAiChatCompletionRequest<'a> {
    model: &'a str,
    messages: Vec<OpenAiChatMessage<'a>>,
    response_format: serde_json::Value,
    temperature: f32,
}

impl<'a> OpenAiChatCompletionRequest<'a> {
    fn from_parts(model: &'a str, request: &'a LlmStructuredRequest) -> Self {
        Self {
            model,
            messages: vec![
                OpenAiChatMessage {
                    role: "system",
                    content: &request.system_prompt,
                },
                OpenAiChatMessage {
                    role: "user",
                    content: &request.user_prompt,
                },
                OpenAiChatMessage {
                    role: "user",
                    content: &request.output_schema,
                },
            ],
            response_format: json!({ "type": "json_object" }),
            temperature: 0.2,
        }
    }
}

#[derive(Debug, Serialize)]
struct OpenAiChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Serialize)]
struct OpenAiResponsesRequest<'a> {
    model: &'a str,
    instructions: &'a str,
    input: String,
    text: serde_json::Value,
    temperature: f32,
}

impl<'a> OpenAiResponsesRequest<'a> {
    fn from_parts(model: &'a str, request: &'a LlmStructuredRequest) -> Self {
        Self {
            model,
            instructions: &request.system_prompt,
            input: format!(
                "{}\n\nOutput schema:\n{}",
                request.user_prompt, request.output_schema
            ),
            text: json!({ "format": { "type": "json_object" } }),
            temperature: 0.2,
        }
    }
}

#[derive(Debug, Serialize)]
struct ClaudeMessagesRequest<'a> {
    model: &'a str,
    system: &'a str,
    max_tokens: u16,
    messages: Vec<ClaudeMessage<'a>>,
}

impl<'a> ClaudeMessagesRequest<'a> {
    fn from_parts(model: &'a str, request: &'a LlmStructuredRequest) -> Self {
        Self {
            model,
            system: &request.system_prompt,
            max_tokens: 4096,
            messages: vec![ClaudeMessage {
                role: "user",
                content: format!(
                    "{}\n\nOutput schema:\n{}",
                    request.user_prompt, request.output_schema
                ),
            }],
        }
    }
}

#[derive(Debug, Serialize)]
struct ClaudeMessage<'a> {
    role: &'a str,
    content: String,
}

#[derive(Debug, Serialize)]
struct GeminiGenerateContentRequest {
    contents: Vec<GeminiContent>,
    system_instruction: GeminiContent,
    generation_config: serde_json::Value,
}

impl GeminiGenerateContentRequest {
    fn from_request(request: &LlmStructuredRequest) -> Self {
        Self {
            system_instruction: GeminiContent {
                parts: vec![GeminiPart {
                    text: request.system_prompt.clone(),
                }],
            },
            contents: vec![GeminiContent {
                parts: vec![GeminiPart {
                    text: format!(
                        "{}\n\nOutput schema:\n{}",
                        request.user_prompt, request.output_schema
                    ),
                }],
            }],
            generation_config: json!({
                "temperature": 0.2,
                "responseMimeType": "application/json"
            }),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatCompletionResponse {
    choices: Vec<OpenAiChatChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatChoice {
    message: OpenAiChatMessageResponse,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatMessageResponse {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiResponsesResponse {
    output: Vec<OpenAiResponsesOutput>,
}

impl OpenAiResponsesResponse {
    fn output_text(self) -> String {
        self.output
            .into_iter()
            .flat_map(|output| output.content)
            .filter_map(|content| match content {
                OpenAiResponsesContent::OutputText { text, .. } => Some(text),
                OpenAiResponsesContent::Other => None,
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

#[derive(Debug, Deserialize)]
struct OpenAiResponsesOutput {
    content: Vec<OpenAiResponsesContent>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum OpenAiResponsesContent {
    #[serde(rename = "output_text")]
    OutputText { text: String },
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct ClaudeMessagesResponse {
    content: Vec<ClaudeContent>,
}

impl ClaudeMessagesResponse {
    fn output_text(self) -> String {
        self.content
            .into_iter()
            .filter_map(|content| match content {
                ClaudeContent::Text { text, .. } => Some(text),
                ClaudeContent::Other => None,
            })
            .collect::<Vec<_>>()
            .join("\n")
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClaudeContent {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct GeminiGenerateContentResponse {
    candidates: Vec<GeminiCandidate>,
}

impl GeminiGenerateContentResponse {
    fn output_text(self) -> String {
        self.candidates
            .into_iter()
            .flat_map(|candidate| candidate.content.parts)
            .map(|part| part.text)
            .collect::<Vec<_>>()
            .join("\n")
    }
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: GeminiContent,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

fn map_http_status(status: StatusCode) -> Result<(), LlmError> {
    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(LlmError::ProviderNotConfigured),
        status if status.is_client_error() => Err(LlmError::Refusal),
        status if status.is_server_error() => Err(LlmError::Timeout),
        _ => Ok(()),
    }
}

fn non_empty_response(
    content: String,
    prompt_version: String,
) -> Result<LlmStructuredResponse, LlmError> {
    if content.trim().is_empty() {
        return Err(LlmError::MalformedOutput);
    }

    Ok(LlmStructuredResponse {
        content,
        prompt_version,
    })
}

fn map_transport_error(error: reqwest::Error) -> LlmError {
    if error.is_timeout() {
        LlmError::Timeout
    } else {
        LlmError::ProviderNotConfigured
    }
}
