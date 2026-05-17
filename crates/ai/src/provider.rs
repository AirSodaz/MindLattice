use std::time::Duration;

use reqwest::{blocking::Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LlmProviderConfig {
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

#[derive(Clone, Debug)]
pub struct OpenAiCompatibleProvider {
    config: LlmProviderConfig,
    client: Client,
}

impl OpenAiCompatibleProvider {
    pub fn new(config: LlmProviderConfig) -> Result<Self, LlmConfigError> {
        config.validate()?;
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .map_err(|_| LlmConfigError::InvalidTimeout)?;
        Ok(Self { config, client })
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

        match response.status() {
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                return Err(LlmError::ProviderNotConfigured);
            }
            status if status.is_client_error() => return Err(LlmError::Refusal),
            status if status.is_server_error() => return Err(LlmError::Timeout),
            _ => {}
        }

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
        if content.trim().is_empty() {
            return Err(LlmError::MalformedOutput);
        }

        Ok(LlmStructuredResponse {
            content,
            prompt_version,
        })
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

fn map_transport_error(error: reqwest::Error) -> LlmError {
    if error.is_timeout() {
        LlmError::Timeout
    } else {
        LlmError::ProviderNotConfigured
    }
}
