use axum::{
    extract::Json,
    http::{HeaderValue, Method, StatusCode},
    routing::{get, post},
    Router,
};
use modyra_contract::{DynamicFormV2, DynamicNode, Field, OptionItem, Validators};
use std::collections::BTreeMap;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tower_http::cors::CorsLayer;

#[derive(Debug, Clone)]
struct CheckoutConfiguration {
    countries: Vec<Country>,
    default_country: String,
    default_sku: String,
    default_quantity: u32,
}

#[derive(Debug, Clone)]
struct Country {
    code: String,
    label: String,
}

impl Default for CheckoutConfiguration {
    fn default() -> Self {
        Self {
            countries: vec![
                Country { code: "IT".into(), label: "Italy".into() },
                Country { code: "DE".into(), label: "Germany".into() },
                Country { code: "US".into(), label: "United States".into() },
            ],
            default_country: "IT".into(),
            default_sku: "TSHIRT-BLK-M".into(),
            default_quantity: 2,
        }
    }
}

fn validators(required: bool) -> Validators {
    Validators {
        required: Some(required), email: None, min: None, max: None,
        min_length: None, max_length: None, pattern: None,
    }
}

fn field(kind: &str, label: &str, initial: Option<Value>, validators: Option<Validators>) -> DynamicNode {
    DynamicNode::Field { field: Field {
        name: "leaf".into(), kind: kind.into(), label: Some(label.into()),
        placeholder: None, initial_value: initial, validators,
        min: None, max: None, step: None, options: None,
    }}
}

fn checkout_form(config: &CheckoutConfiguration) -> DynamicFormV2 {
    let country_options = config.countries.iter().map(|country| OptionItem {
        value: json!(country.code), label: country.label.clone(), disabled: None,
    }).collect();
    let mut country = match field("select", "Country", Some(json!(config.default_country)), Some(validators(true))) {
        DynamicNode::Field { field } => field,
        _ => unreachable!(),
    };
    country.options = Some(country_options);

    let mut qty = match field("number", "Quantity", Some(json!(1)), Some(Validators { min: Some(1.0), ..validators(true) })) {
        DynamicNode::Field { field } => field,
        _ => unreachable!(),
    };
    qty.min = Some(1.0); qty.max = Some(100.0); qty.step = Some(1.0);

    let shipping = DynamicNode::Group {
        label: Some("Shipping address".into()),
        children: BTreeMap::from([
            ("city".into(), field("text", "City", None, Some(validators(true)))),
            ("zip".into(), field("text", "ZIP", None, Some(Validators { pattern: Some("^\\d{5}$".into()), ..validators(true) }))),
        ]),
    };
    let item = DynamicNode::Group {
        label: None,
        children: BTreeMap::from([
            ("sku".into(), field("text", "SKU", None, Some(validators(true)))),
            ("qty".into(), DynamicNode::Field { field: qty }),
        ]),
    };
    let schema = DynamicNode::Group {
        label: Some("Checkout".into()),
        children: BTreeMap::from([
            ("country".into(), DynamicNode::Field { field: country }),
            ("shipping".into(), shipping),
            ("items".into(), DynamicNode::Array {
                label: Some("Items".into()),
                item: Box::new(item),
                initial_value: vec![json!({ "sku": config.default_sku, "qty": config.default_quantity })],
                min_items: Some(1), max_items: Some(20),
            }),
            ("coupon".into(), field("text", "Coupon", None, None)),
        ]),
    };

    DynamicFormV2 {
        version: 2, id: Some("checkout".into()), fields: vec![],
        schema: Some(schema), layout: vec![], rules: vec![],
    }
}

async fn get_checkout_form() -> Json<DynamicFormV2> {
    Json(checkout_form(&CheckoutConfiguration::default()))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckoutSubmission { form_revision: u32, values: Value }

#[derive(Debug, Serialize)]
struct FormError { path: Option<String>, kind: String, message: String }

#[derive(Debug, Serialize)]
struct SubmissionResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    submission_id: Option<String>,
    errors: Vec<FormError>,
}

fn value_at<'a>(values: &'a Value, dotted: &str) -> Option<&'a Value> {
    if let Some(value) = values.get(dotted) { return Some(value); }
    dotted.split('.').try_fold(values, |current, part| {
        if let Ok(index) = part.parse::<usize>() { current.as_array()?.get(index) }
        else { current.as_object()?.get(part) }
    })
}

async fn submit_checkout(Json(payload): Json<CheckoutSubmission>) -> (StatusCode, Json<SubmissionResponse>) {
    println!("checkout revision {}: {:#}", payload.form_revision, payload.values);
    let mut errors = Vec::new();
    for field in ["country", "shipping.city", "shipping.zip", "items.0.sku", "items.0.qty"] {
        let missing = match value_at(&payload.values, field) {
            None | Some(Value::Null) => true,
            Some(Value::String(value)) => value.trim().is_empty(),
            _ => false,
        };
        if missing { errors.push(FormError { path: Some(field.into()), kind: "server".into(), message: "Required by the Rust checkout service".into() }); }
    }
    if value_at(&payload.values, "shipping.zip").and_then(Value::as_str).is_some_and(|zip| zip.len() != 5 || !zip.chars().all(|c| c.is_ascii_digit())) {
        errors.push(FormError { path: Some("shipping.zip".into()), kind: "server".into(), message: "ZIP must contain exactly 5 digits".into() });
    }
    let coupon = value_at(&payload.values, "coupon").and_then(Value::as_str).unwrap_or("");
    let country = value_at(&payload.values, "country").and_then(Value::as_str).unwrap_or("");
    if !coupon.is_empty() && !matches!((country, coupon), ("IT", "ITALY10") | ("DE", "GERMANY10") | ("US", "USA10")) {
        errors.push(FormError { path: Some("coupon".into()), kind: "server".into(), message: "Coupon not valid for your country".into() });
    }
    if !errors.is_empty() {
        return (StatusCode::UNPROCESSABLE_ENTITY, Json(SubmissionResponse { ok: false, submission_id: None, errors }));
    }
    (StatusCode::CREATED, Json(SubmissionResponse { ok: true, submission_id: Some("sub_rust_checkout_001".into()), errors: vec![] }))
}

fn app() -> Router {
    let cors = CorsLayer::new()
        .allow_origin("http://localhost:4200".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    Router::new()
        .route("/v1/forms/checkout", get(get_checkout_form))
        .route("/v1/forms/checkout/submissions", post(submit_checkout))
        .layer(cors)
}

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("cannot bind port 3000");
    println!("Modyra Rust form API: http://127.0.0.1:3000/v1/forms/checkout");
    axum::serve(listener, app()).await.expect("server failed");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    #[tokio::test]
    async fn returns_recursive_checkout_to_the_angular_client() {
        let response = app()
            .oneshot(
                Request::builder()
                    .uri("/v1/forms/checkout")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["version"], 2);
        assert_eq!(json["schema"]["node"], "group");
        assert_eq!(json["schema"]["children"]["shipping"]["node"], "group");
        assert_eq!(json["schema"]["children"]["items"]["node"], "array");
        assert_eq!(json["schema"]["children"]["items"]["initialValue"][0]["qty"], 2);
        assert!(json.get("fields").is_none());
        assert!(json["schema"]["children"]["coupon"]["field"]
            .get("validators")
            .is_none());
    }

    #[tokio::test]
    async fn accepts_the_nested_checkout_posted_by_angular() {
        let body = json!({
            "formRevision": 1,
            "values": {
                "country": "IT",
                "shipping": { "city": "Rome", "zip": "00100" },
                "items": [{ "sku": "TSHIRT-BLK-M", "qty": 2 }],
                "coupon": "ITALY10"
            }
        });
        let response = app()
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/v1/forms/checkout/submissions")
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::CREATED);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["ok"], true);
        assert_eq!(json["submission_id"], "sub_rust_checkout_001");
    }
}
