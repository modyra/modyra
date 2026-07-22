use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FormSubmission {
    form_id: String,
    contract_version: u8,
    revision: u32,
    values: Value,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    path: Option<String>,
    kind: String,
    message: String,
}

#[derive(Debug, Deserialize)]
struct SubmissionResponse {
    #[serde(default)]
    ok: bool,
    #[serde(default)]
    submission_id: Option<String>,
    #[serde(default)]
    errors: Vec<ApiError>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let endpoint = env::var("MODYRA_ENDPOINT").unwrap_or_else(|_| {
        "http://127.0.0.1:3000/v1/forms/business-signup/submissions".to_string()
    });

    let payload = FormSubmission {
        form_id: "business-signup".to_string(),
        contract_version: 2,
        revision: 1,
        values: serde_json::json!({
            "customerType": "business",
            "vatNumber": "IT12345678901"
        }),
    };

    println!("POST {endpoint}");
    println!("Request body:\n{}", serde_json::to_string_pretty(&payload)?);

    let client = reqwest::Client::builder()
        .user_agent("modyra-rust-example/0.1.0")
        .build()?;

    let mut request = client
        .post(&endpoint)
        .header("Idempotency-Key", "example-business-signup-001")
        .json(&payload);

    if let Ok(token) = env::var("MODYRA_API_TOKEN") {
        request = request.bearer_auth(token);
    }

    let response = request.send().await?;
    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("<missing>")
        .to_string();
    let body = response.text().await?;

    println!("\nHTTP status: {status}");
    println!("Content-Type: {content_type}");
    println!("Raw response:\n{body}");

    match serde_json::from_str::<SubmissionResponse>(&body) {
        Ok(result) => {
            println!("\nParsed response:\n{result:#?}");
            if result.ok {
                println!(
                    "Submission accepted. ID: {}",
                    result.submission_id.as_deref().unwrap_or("<not returned>")
                );
            } else if !result.errors.is_empty() {
                println!("Submission rejected:");
                for error in result.errors {
                    println!(
                        "  path={} kind={} message={}",
                        error.path.as_deref().unwrap_or("<form>"),
                        error.kind,
                        error.message
                    );
                }
            }
        }
        Err(error) => {
            println!("\nResponse is not in the expected Modyra shape: {error}");
        }
    }

    match status {
        StatusCode::OK | StatusCode::CREATED | StatusCode::ACCEPTED => {
            println!("Result: success");
        }
        StatusCode::UNPROCESSABLE_ENTITY => {
            println!("Result: validation failed");
        }
        StatusCode::BAD_REQUEST => {
            println!("Result: malformed request");
        }
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            println!("Result: authentication or authorization failed");
        }
        _ if status.is_server_error() => {
            println!("Result: server error");
        }
        _ => {
            println!("Result: unexpected HTTP status");
        }
    }

    if !status.is_success() && status != StatusCode::UNPROCESSABLE_ENTITY {
        return Err(format!("request failed with HTTP {status}").into());
    }

    Ok(())
}
