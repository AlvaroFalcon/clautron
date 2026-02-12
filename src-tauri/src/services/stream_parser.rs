use crate::models::message::StreamMessage;
use regex::Regex;
use std::sync::LazyLock;

/// Regex patterns for secret redaction (P0 Security #5).
static SECRET_PATTERNS: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    vec![
        // Anthropic API keys
        Regex::new(r"sk-ant-[a-zA-Z0-9\-_]{20,}").unwrap(),
        // OpenAI-style keys
        Regex::new(r"sk-[a-zA-Z0-9]{20,}").unwrap(),
        // AWS access keys
        Regex::new(r"AKIA[0-9A-Z]{16}").unwrap(),
        // GitHub tokens
        Regex::new(r"ghp_[a-zA-Z0-9]{36}").unwrap(),
        Regex::new(r"gho_[a-zA-Z0-9]{36}").unwrap(),
        Regex::new(r"github_pat_[a-zA-Z0-9_]{22,}").unwrap(),
        // Generic bearer tokens
        Regex::new(r"Bearer\s+[a-zA-Z0-9\-_.]{20,}").unwrap(),
        // Generic API key patterns in key=value
        Regex::new(r#"(?i)(api[_-]?key|secret|token|password)\s*[=:]\s*['"]?[a-zA-Z0-9\-_.]{16,}['"]?"#).unwrap(),
    ]
});

/// Redact secrets from a string before persisting to logs.
pub fn redact_secrets(input: &str) -> String {
    let mut result = input.to_string();
    for pattern in SECRET_PATTERNS.iter() {
        result = pattern.replace_all(&result, "[REDACTED]").to_string();
    }
    result
}

/// Parse a single line of stream-json output into a typed message.
pub fn parse_stream_line(line: &str) -> Option<StreamMessage> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    match serde_json::from_str::<StreamMessage>(trimmed) {
        Ok(msg) => Some(msg),
        Err(_) => {
            // Not a valid stream-json message; skip silently.
            // This handles non-JSON stderr leaking into stdout, etc.
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_redact_anthropic_key() {
        let input = "Using key sk-ant-api03-abcdefghijklmnopqrstuvwxyz";
        let result = redact_secrets(input);
        assert!(result.contains("[REDACTED]"));
        assert!(!result.contains("sk-ant-"));
    }

    #[test]
    fn test_redact_github_token() {
        let input = "token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh";
        let result = redact_secrets(input);
        assert!(result.contains("[REDACTED]"));
        assert!(!result.contains("ghp_"));
    }

    #[test]
    fn test_redact_aws_key() {
        let input = "AWS key: AKIAIOSFODNN7EXAMPLE";
        let result = redact_secrets(input);
        assert!(result.contains("[REDACTED]"));
    }

    #[test]
    fn test_no_false_positive() {
        let input = "This is a normal log message with no secrets";
        let result = redact_secrets(input);
        assert_eq!(result, input);
    }

    #[test]
    fn test_parse_system_message() {
        let line = r#"{"type":"system","subtype":"init","session_id":"abc"}"#;
        let msg = parse_stream_line(line).unwrap();
        assert!(matches!(msg, StreamMessage::System(_)));
    }

    #[test]
    fn test_parse_empty_line() {
        assert!(parse_stream_line("").is_none());
        assert!(parse_stream_line("  ").is_none());
    }

    #[test]
    fn test_parse_invalid_json() {
        assert!(parse_stream_line("not json at all").is_none());
    }
}
