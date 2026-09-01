use axum::{
    extract::Json,
    http::{HeaderValue, Method, StatusCode},
    routing::{get, post},
    Router,
};
use axum::extract::State;
use modyra_contract::{DynamicFormV2, DynamicNode, Field, OptionItem, Validators};
use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
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
        required: Some(required), email: None, integer: None, min: None, max: None,
        min_length: None, max_length: None, pattern: None, messages: None,
    }
}

fn field(kind: &str, label: &str, initial: Option<Value>, validators: Option<Validators>) -> DynamicNode {
    DynamicNode::Field { when: None, async_when: None, field: Field {
        name: "leaf".into(), kind: kind.into(), label: Some(label.into()),
        placeholder: None, initial_value: initial, validators,
        min: None, max: None, step: None, options: None,
        mode: None, searchable: None,
    }}
}

fn checkout_form(config: &CheckoutConfiguration) -> DynamicFormV2 {
    let country_options = config.countries.iter().map(|country| OptionItem {
        value: json!(country.code), label: country.label.clone(), disabled: None,
    }).collect();
    let mut country = match field("select", "Country", Some(json!(config.default_country)), Some(validators(true))) {
        DynamicNode::Field { field, .. } => field,
        _ => unreachable!(),
    };
    country.options = Some(country_options);

    let mut qty = match field("number", "Quantity", Some(json!(1)), Some(Validators { min: Some(1.0), integer: Some(true), ..validators(true) })) {
        DynamicNode::Field { field, .. } => field,
        _ => unreachable!(),
    };
    qty.min = Some(1.0); qty.max = Some(100.0); qty.step = Some(1.0);

    let shipping = DynamicNode::Group {
        label: Some("Shipping address".into()),
        when: None,
        children: BTreeMap::from([
            ("city".into(), field("text", "City", None, Some(validators(true)))),
            ("zip".into(), field("text", "ZIP", None, Some(Validators { pattern: Some("^\\d{5}$".into()), ..validators(true) }))),
        ]),
    };
    let item = DynamicNode::Group {
        label: None,
        when: None,
        children: BTreeMap::from([
            ("sku".into(), field("text", "SKU", None, Some(validators(true)))),
            ("qty".into(), DynamicNode::Field { field: qty, when: None, async_when: None }),
        ]),
    };
    let schema = DynamicNode::Group {
        label: Some("Checkout".into()),
        when: None,
        children: BTreeMap::from([
            ("country".into(), DynamicNode::Field { field: country, when: None, async_when: None }),
            ("shipping".into(), shipping),
            ("items".into(), DynamicNode::Array {
                label: Some("Items".into()),
                when: None,
                item: Box::new(item),
                initial_value: vec![json!({ "sku": config.default_sku, "qty": config.default_quantity })],
                min_items: Some(1), max_items: Some(20),
            }),
            ("coupon".into(), field("text", "Coupon", None, None)),
        ]),
    };

    DynamicFormV2 {
        version: 5, id: Some("checkout".into()), fields: vec![],
        schema: Some(schema), layout: vec![], rules: vec![], requires_context: vec![],
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


/// How long a lease stands without being renewed. A client refreshes at a third of it, so two
/// missed heartbeats are tolerated before it is considered gone.
const LEASE_TTL: Duration = Duration::from_secs(30);

/// Who is holding the server open, and whether anybody ever did.
///
/// The demos each hold one, by name: two starts of the same demo refresh a single lease rather
/// than stacking two, because what is being counted is *demos open*, not *requests made*.
#[derive(Clone)]
struct Leases {
    held: Arc<Mutex<(BTreeMap<String, Instant>, bool)>>,
    linked: bool,
}

impl Leases {
    fn new(linked: bool) -> Self {
        Self { held: Arc::new(Mutex::new((BTreeMap::new(), false))), linked }
    }

    /// Open or renew a named lease. Idempotent: the name is the identity.
    fn renew(&self, client: &str, now: Instant) {
        let mut guard = self.held.lock().unwrap();
        guard.0.insert(client.to_string(), now + LEASE_TTL);
        guard.1 = true;
    }

    /// The leases still standing at `now`, dropping the rest.
    fn live(&self, now: Instant) -> Vec<String> {
        let mut guard = self.held.lock().unwrap();
        guard.0.retain(|_, expires| *expires > now);
        guard.0.keys().cloned().collect()
    }

    fn ever_held(&self) -> bool {
        self.held.lock().unwrap().1
    }
}

/// Whether the server has been left with nothing to stay up for.
///
/// Three conditions, and all three are needed. `linked` is the regime the launcher chose, so a
/// server started for manual API work never leaves on its own. `ever_held` keeps a linked server
/// alive during the moment between binding the port and the launcher's first lease — without it a
/// linked server exits before the demo it was started for can say hello. `live == 0` is the
/// question everyone thinks this is.
fn should_stand_down(linked: bool, ever_held: bool, live: usize) -> bool {
    linked && ever_held && live == 0
}

#[derive(Deserialize)]
struct LeaseRequest {
    client: String,
}

async fn open_lease(State(leases): State<Leases>, Json(body): Json<LeaseRequest>) -> Json<Value> {
    let now = Instant::now();
    leases.renew(&body.client, now);
    Json(json!({
        "client": body.client,
        "ttlSeconds": LEASE_TTL.as_secs(),
        "renewWithinSeconds": LEASE_TTL.as_secs() / 3,
        "leases": leases.live(now),
    }))
}

/// What regime this server is in, so nobody has to guess it from how it was started.
async fn health(State(leases): State<Leases>) -> Json<Value> {
    let live = leases.live(Instant::now());
    Json(json!({
        "mode": if leases.linked { "linked" } else { "standalone" },
        "leases": live,
        "willExitWhenLeasesEnd": leases.linked,
    }))
}

fn app_with(leases: Leases) -> Router {
    // Every demo that talks to this server, by the port its launcher uses. Named rather than
    // opened to anything: a development server that answers the whole internet is a habit that
    // travels, and the list is three lines.
    let origins = ["http://localhost:4200", "http://localhost:4303", "http://localhost:4307"]
        .iter()
        .map(|origin| origin.parse::<HeaderValue>().unwrap())
        .collect::<Vec<_>>();
    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    Router::new()
        .route("/v1/forms/checkout", get(get_checkout_form))
        .route("/v1/forms/checkout/submissions", post(submit_checkout))
        .route("/lease", post(open_lease))
        .route("/health", get(health))
        .layer(cors)
        .with_state(leases)
}

#[cfg(test)]
fn app() -> Router {
    app_with(Leases::new(false))
}

#[tokio::main]
async fn main() {
    // The regime is chosen by whoever starts the server, and said out loud: the demo launcher passes
    // `--linked` so the server goes away with the demos, and a person testing the API starts it
    // without the flag and keeps it. Either way `/health` reports which, so nobody infers it.
    let linked = std::env::args().any(|argument| argument == "--linked");
    let leases = Leases::new(linked);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000")
        .await
        .expect("cannot bind port 3000");
    println!("Modyra Rust form API: http://127.0.0.1:3000/v1/forms/checkout");
    println!(
        "mode: {} — {}",
        if linked { "linked" } else { "standalone" },
        if linked {
            "exits once every lease has expired"
        } else {
            "stays up; leases are accepted and do not end it"
        }
    );

    let watching = leases.clone();
    axum::serve(listener, app_with(leases))
        .with_graceful_shutdown(async move {
            loop {
                tokio::time::sleep(LEASE_TTL / 3).await;
                let live = watching.live(Instant::now());
                if should_stand_down(watching.linked, watching.ever_held(), live.len()) {
                    // A server that vanishes without saying why is a thing to diagnose; one that
                    // says why is a behaviour.
                    println!("last lease expired, shutting down");
                    return;
                }
            }
        })
        .await
        .expect("server failed");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    /// The three conditions that end a linked server, each shown to matter on its own.
    ///
    /// Tested as a decision rather than as a process: a test that starts a server and waits for it
    /// to die measures the clock as much as the rule, and is the kind that passes on a fast machine
    /// and fails on a loaded one.
    #[test]
    fn a_server_stands_down_only_when_all_three_conditions_hold() {
        assert!(should_stand_down(true, true, 0), "linked, leased, and none left: this is the case");

        assert!(
            !should_stand_down(false, true, 0),
            "a standalone server must not leave when a demo that borrowed it closes"
        );
        assert!(
            !should_stand_down(true, false, 0),
            "a linked server must survive the gap between binding the port and its first lease"
        );
        assert!(
            !should_stand_down(true, true, 1),
            "a lease still standing is a reason to stay"
        );
    }

    /// A lease is named, so the same demo starting twice is one reason to stay, not two.
    #[test]
    fn a_lease_is_identified_by_its_holder() {
        let leases = Leases::new(true);
        let now = Instant::now();

        assert!(!leases.ever_held(), "nothing has been held yet");
        leases.renew("demo-angular", now);
        leases.renew("demo-angular", now);
        assert_eq!(leases.live(now), vec!["demo-angular"], "one demo, one lease");

        leases.renew("demo-lit", now);
        assert_eq!(leases.live(now).len(), 2, "two demos, two leases");

        // Past every expiry: the holders are gone, but that they existed is not forgotten — which
        // is what tells a linked server it was started for something rather than started early.
        let later = now + LEASE_TTL + Duration::from_secs(1);
        assert!(leases.live(later).is_empty(), "an unrenewed lease does not stand");
        assert!(leases.ever_held(), "a server must remember it was once held");
        assert!(should_stand_down(true, leases.ever_held(), leases.live(later).len()));
    }

    #[tokio::test]
    async fn health_says_which_regime_it_is_in() {
        for (linked, expected) in [(true, "linked"), (false, "standalone")] {
            let response = app_with(Leases::new(linked))
                .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK);
            let bytes = response.into_body().collect().await.unwrap().to_bytes();
            let json: Value = serde_json::from_slice(&bytes).unwrap();
            assert_eq!(json["mode"], expected, "the regime must be readable, not inferred");
            assert_eq!(json["willExitWhenLeasesEnd"], linked);
        }
    }

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
        // What the server writes, the contract reader must accept — strictly, and without being
        // told which version to expect. A literal here would have to be edited every time the
        // language grows, which is the edit that gets forgotten; parsing is the assertion that
        // cannot go stale.
        let verdict = modyra_contract::parse_v2(
            std::str::from_utf8(&bytes).unwrap(),
            modyra_contract::ValidationMode::Strict,
        )
        .expect("the served document is not JSON the reader can take");
        assert!(
            verdict.valid,
            "the server served a document its own contract reader refuses: {:?}",
            verdict.diagnostics
        );
        assert_eq!(json["version"], 5, "the demo serves the newest version the reader accepts");
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
