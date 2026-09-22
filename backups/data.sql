SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict XGcpsBDwrhvrG0JYb6cbJiPf1UQc18ec6sx6BpkBIxzcX4WwzvGFDdB2gER6mca

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."custom_oauth_providers" ("id", "provider_type", "identifier", "name", "client_id", "client_secret", "acceptable_client_ids", "scopes", "pkce_enabled", "attribute_mapping", "authorization_params", "enabled", "email_optional", "issuer", "discovery_url", "skip_nonce_check", "cached_discovery", "discovery_cached_at", "authorization_url", "token_url", "userinfo_url", "jwks_uri", "created_at", "updated_at", "custom_claims_allowlist") FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") FROM stdin;
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") FROM stdin;
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_clients" ("id", "client_secret_hash", "registration_type", "redirect_uris", "grant_types", "client_name", "client_uri", "logo_uri", "created_at", "updated_at", "deleted_at", "client_type", "token_endpoint_auth_method") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_factors" ("id", "user_id", "friendly_name", "factor_type", "status", "created_at", "updated_at", "secret", "phone", "last_challenged_at", "web_authn_credential", "web_authn_aaguid", "last_webauthn_challenge_data") FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_challenges" ("id", "factor_id", "created_at", "verified_at", "ip_address", "otp_code", "web_authn_session_data") FROM stdin;
\.


--
-- Data for Name: mfa_recovery_code_sets; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_recovery_code_sets" ("id", "user_id", "mfa_factor_id", "failed_verification_count", "verification_locked_until", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: mfa_recovery_codes; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_recovery_codes" ("id", "mfa_recovery_code_set_id", "code_hash", "consumed_at", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_authorizations" ("id", "authorization_id", "client_id", "user_id", "redirect_uri", "scope", "state", "resource", "code_challenge", "code_challenge_method", "response_type", "status", "authorization_code", "created_at", "expires_at", "approved_at", "nonce") FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_client_states" ("id", "provider_type", "code_verifier", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_consents" ("id", "user_id", "client_id", "scopes", "granted_at", "revoked_at") FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_providers" ("id", "resource_id", "created_at", "updated_at", "disabled") FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_providers" ("id", "sso_provider_id", "entity_id", "metadata_xml", "metadata_url", "attribute_mapping", "created_at", "updated_at", "name_id_format") FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_relay_states" ("id", "sso_provider_id", "request_id", "for_email", "redirect_to", "created_at", "updated_at", "flow_state_id") FROM stdin;
\.


--
-- Data for Name: scim_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."scim_tokens" ("id", "sso_provider_id", "token_hash", "prefix", "created_at", "expires_at", "revoked_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: scim_users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."scim_users" ("id", "sso_provider_id", "user_id", "resource", "created_at", "updated_at", "deleted_at") FROM stdin;
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_domains" ("id", "sso_provider_id", "domain", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_challenges" ("id", "user_id", "challenge_type", "session_data", "created_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_credentials" ("id", "user_id", "credential_id", "public_key", "attestation_type", "aaguid", "sign_count", "transports", "backup_eligible", "backed_up", "friendly_name", "created_at", "updated_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: favorite_services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."favorite_services" ("id", "type", "name", "country", "city", "notes", "active", "created_at", "updated_at") FROM stdin;
274f4bf0-3d1d-44f4-ac4d-f4161e720c06	hotel	Hotel das Flores	Brasil	Rio de Janeiro	\N	t	2026-09-09 13:23:11.920287+00	2026-09-09 23:07:38.673213+00
\.


--
-- Data for Name: packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."packages" ("id", "reference", "name", "status", "data", "base_currency", "created_at", "updated_at") FROM stdin;
6718e2f4-827e-44e3-a03a-f71fa5b06d4c	PK-2026-003	Porto - Milão + Lugano	active	{"dates": {"endDate": "2026-10-17", "startDate": "2026-10-14", "durationDays": 4, "durationNights": 3}, "lodging": [{"id": "hotel-1", "name": "Joy 124 Hotel Milano", "mealPlan": "Apenas alojamento (RO)", "destination": "Milão"}], "financials": {"profit": 97, "currency": "EUR", "salePrice": 658, "totalCost": 561, "components": [{"id": "cost_outboundRoute_1789386955762_awgm", "notes": "15:15-18:40", "amount": 38, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "Ryanair (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (OPO)"}, {"id": "cost_inboundRoute_1789386963589_5eut", "notes": "21:50-23:30", "amount": 38, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "Ryanair (MXP)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (MXP)"}, {"id": "cost_hotelName_1789387566058_ox0y", "amount": 345, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Joy 124 Hotel Milano", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "Joy 124 Hotel Milano"}, {"id": "cost_1789387638128_d8xuy", "notes": "07:43\\t18:02", "amount": 32, "category": "services", "currency": "EUR", "quantity": 2, "description": "Bilhete Trenord Milão<->Lugano", "isCustomized": true}], "priceTotal": {"amount": 658, "currency": "EUR"}, "profitPercent": 14.74, "pricePerPerson": 329, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 329, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "additionalInfo": "Tx.local: 60€", "inboundTransport": {"type": "flight", "route": "Ryanair (MXP)"}, "outboundTransport": {"type": "flight", "route": "Ryanair (OPO)"}}	EUR	2026-09-14 12:10:33.70397+00	2026-09-14 12:12:22.795038+00
7bcef242-25b2-4e47-ba16-f8dc3bb385d5	PK-2026-001	Porto - Paris + Disney	active	{"dates": {"endDate": "2026-11-21", "startDate": "2026-11-19", "durationDays": 3, "durationNights": 2}, "lodging": [{"id": "hotel-1", "name": "B&B HOTEL Paris Porte de Bagnolet", "mealPlan": "Apenas alojamento (RO)", "destination": "Paris"}], "financials": {"profit": 125, "currency": "EUR", "salePrice": 598, "totalCost": 473, "components": [{"id": "cost_hotelName_1789381826931_bvel", "amount": 139, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "B&B HOTEL Paris Porte de Bagnolet", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "B&B HOTEL Paris Porte de Bagnolet"}, {"id": "cost_outboundRoute_1789381853062_r8l6", "notes": "06:15-09:25", "amount": 98, "category": "outbound_transport", "currency": "EUR", "quantity": 1, "description": "Easyjet (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (OPO)"}, {"id": "cost_inboundRoute_1789381856620_kptd", "notes": "10:20-11:30", "amount": 98, "category": "inbound_transport", "currency": "EUR", "quantity": 1, "description": "Easyjet (ORY)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (ORY)"}, {"id": "cost_1789382169854_rydl3", "notes": "20/11", "amount": 138, "category": "services", "currency": "EUR", "quantity": 1, "description": "Bilhete Disneyland Paris 1 dia", "isCustomized": true}], "priceTotal": {"amount": 598, "currency": "EUR"}, "profitPercent": 20.9, "pricePerPerson": 299, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 299, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "additionalInfo": "Taxa local: 22€", "inboundTransport": {"type": "flight", "route": "Easyjet (ORY)"}, "outboundTransport": {"type": "flight", "route": "Easyjet (OPO)"}}	EUR	2026-09-14 10:42:38.386113+00	2026-09-14 12:11:57.598549+00
1d7db3ec-a142-40cc-b409-099b6330858f	PK-2026-002	Porto - Paris Reveillon 2027	active	{"dates": {"endDate": "2027-01-02", "startDate": "2026-12-31", "durationDays": 3, "durationNights": 2}, "lodging": [{"id": "hotel-1", "name": "ibis Paris Porte de Vanves Parc des Expositions", "mealPlan": "Apenas alojamento (RO)", "destination": "Paris"}], "financials": {"profit": 146, "currency": "EUR", "salePrice": 640, "totalCost": 494, "components": [{"id": "cost_outboundRoute_1789386755785_c4lb", "notes": "06:15-09:25", "amount": 141, "category": "outbound_transport", "currency": "EUR", "quantity": 1, "description": "Easyjet (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (OPO)"}, {"id": "cost_inboundRoute_1789386765483_9wfz", "notes": "10:20-11:30", "amount": 141, "category": "inbound_transport", "currency": "EUR", "quantity": 1, "description": "Easyjet (OPO)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (OPO)"}, {"id": "cost_hotelName_1789386774517_478m", "amount": 212, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "ibis Paris Porte de Vanves Parc des Expositions", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "ibis Paris Porte de Vanves Parc des Expositions"}], "priceTotal": {"amount": 640, "currency": "EUR"}, "profitPercent": 22.81, "pricePerPerson": 320, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 320, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "additionalInfo": "Tx.local: 23€", "inboundTransport": {"type": "flight", "route": "Easyjet (OPO)"}, "outboundTransport": {"type": "flight", "route": "Easyjet (OPO)"}}	EUR	2026-09-14 11:54:26.449789+00	2026-09-14 12:12:12.646226+00
aaff77e6-3f8a-4379-a3e3-3d044331266b	PK-2026-004	Porto - Maiorca	active	{"dates": {"endDate": "2026-10-22", "startDate": "2026-10-19", "durationDays": 4, "durationNights": 3}, "lodging": [{"id": "hotel-1", "name": "tent Bahia de Palma", "mealPlan": "Café da manhã (BB)", "destination": "Maiorca"}], "financials": {"profit": 43, "currency": "EUR", "salePrice": 398, "totalCost": 355, "components": [{"id": "cost_outboundRoute_1789388054492_2eqz", "notes": "20:50h-23:40h", "amount": 22, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "Ryanair (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (OPO)"}, {"id": "cost_inboundRoute_1789388057400_4rpv", "notes": "22:20h-23:15h", "amount": 22, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "Ryanair (PMI)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (PMI)"}, {"id": "cost_hotelName_1789388066375_jcw2", "amount": 267, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "tent Bahia de Palma", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "tent Bahia de Palma"}], "priceTotal": {"amount": 398, "currency": "EUR"}, "profitPercent": 10.8, "pricePerPerson": 199, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 199, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "additionalInfo": "Tx.local: 14", "inboundTransport": {"type": "flight", "route": "Ryanair (PMI)"}, "outboundTransport": {"type": "flight", "route": "Ryanair (OPO)"}}	EUR	2026-09-14 12:15:53.015427+00	2026-09-14 12:15:55.343071+00
8a769ce3-5ef8-43b7-bb2f-05c5ad1977af	PK-2026-005	Porto - Europa Park	active	{"dates": {"endDate": "2026-11-15", "startDate": "2026-11-12", "durationDays": 4, "durationNights": 3}, "lodging": [{"id": "hotel-1", "name": "B&B Hotel Rust-Ettenheim", "mealPlan": "Apenas alojamento (RO)", "destination": "Rust"}], "financials": {"profit": 106, "currency": "EUR", "salePrice": 900, "totalCost": 794, "components": [{"id": "cost_outboundRoute_1789388210468_qtt7", "notes": "14:35-18:05", "amount": 30, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "Easyjet (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (OPO)"}, {"id": "cost_inboundRoute_1789388277885_0b8m", "notes": "13:25-15:15", "amount": 30, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "Easyjet (BSL)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (BSL)"}, {"id": "cost_hotelName_1789388285502_2ga4", "amount": 260, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "B&B Hotel Rust-Ettenheim", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "B&B Hotel Rust-Ettenheim"}, {"id": "cost_1789388323537_60wb3", "notes": "", "amount": 127, "category": "services", "currency": "EUR", "quantity": 2, "description": "Bilhete 2 dias Europa Park", "isCustomized": true}, {"id": "cost_1789388381491_35ipz", "notes": "", "amount": 160, "category": "services", "currency": "EUR", "quantity": 1, "description": "Carro classe económica", "isCustomized": true}], "priceTotal": {"amount": 900, "currency": "EUR"}, "profitPercent": 11.78, "pricePerPerson": 450, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 450, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "additionalInfo": "Tx.local: 0€", "inboundTransport": {"type": "flight", "route": "Easyjet (BSL)"}, "outboundTransport": {"type": "flight", "route": "Easyjet (OPO)"}}	EUR	2026-09-14 12:21:50.839101+00	2026-09-14 12:21:53.047589+00
6bff0f7a-4d8f-4e38-b4c0-e32190412d54	PK-2026-006	Porto - Madrid + Warner	active	{"dates": {"endDate": "2026-11-09", "startDate": "2026-11-07", "durationDays": 3, "durationNights": 2}, "lodging": [{"id": "hotel-1", "name": "Sercotel Las Artes Pinto", "mealPlan": "Apenas alojamento (RO)", "destination": "Madrid"}], "financials": {"profit": 53, "currency": "EUR", "salePrice": 398, "totalCost": 345, "components": [{"id": "cost_outboundRoute_1789388556638_ya49", "notes": "18:50h-21:05h", "amount": 25, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "Ryanair (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (OPO)"}, {"id": "cost_inboundRoute_1789388557825_o4aj", "notes": "23:25h-23:45h", "amount": 25, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "Ryanair (MAD)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (MAD)"}, {"id": "cost_hotelName_1789388564453_l88e", "amount": 165, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Sercotel Las Artes Pinto", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "Sercotel Las Artes Pinto"}, {"id": "cost_1789388647985_rbro9", "notes": "", "amount": 40, "category": "services", "currency": "EUR", "quantity": 2, "description": "Bilhete 1 dia Parque Warner", "isCustomized": true}], "priceTotal": {"amount": 398, "currency": "EUR"}, "profitPercent": 13.32, "pricePerPerson": 199, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 199, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "additionalInfo": "Tx.local: 0€\\nTraslado Ida/Volta:\\t145€\\nAluguel de Carro: 48€", "inboundTransport": {"type": "flight", "route": "Ryanair (MAD)"}, "outboundTransport": {"type": "flight", "route": "Ryanair (OPO)"}}	EUR	2026-09-14 12:25:40.579993+00	2026-09-15 08:24:00.273171+00
f21db55d-0645-44d4-b309-0a2b971df1b2	PK-2026-007	Porto - Colmar	active	{"dates": {"endDate": "2026-11-26", "startDate": "2026-11-23", "durationDays": 4, "durationNights": 3}, "lodging": [{"id": "hotel-1", "name": "Colmar Hotel", "mealPlan": "pequeno-almoço", "destination": "Colmar"}], "financials": {"profit": 161, "currency": "EUR", "salePrice": 1299, "totalCost": 1138, "components": [{"id": "cost_hotelName_1789559404441_hm9g", "amount": 52, "category": "lodging", "currency": "EUR", "quantity": 2, "description": "Colmar Hotel", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "Colmar Hotel"}, {"id": "cost_outboundRoute_1789559415053_zcy2", "notes": "07:00 - 10:30", "amount": 52, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "Easyjet (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (OPO)"}, {"id": "cost_inboundRoute_1789559422353_uozy", "notes": "12:15 - 13:55", "amount": 570, "category": "inbound_transport", "currency": "EUR", "quantity": 1, "description": "Easyjet (BSL)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (BSL)"}, {"id": "cost_1789559464521_oqark", "notes": "", "amount": 360, "category": "services", "currency": "EUR", "quantity": 1, "description": "Transfere ida/volta", "isCustomized": true}], "priceTotal": {"amount": 1299, "currency": "EUR"}, "profitPercent": 12.39, "pricePerPerson": 649.5, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 649.5, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "additionalInfo": "Tarifa somente mochila\\nTx.local: 12€", "inboundTransport": {"type": "flight", "route": "Easyjet (BSL)"}, "outboundTransport": {"type": "flight", "route": "Easyjet (OPO)"}}	EUR	2026-09-16 11:55:19.937369+00	2026-09-16 11:55:23.377763+00
5aa77ff7-815b-442b-b9d2-80884b82728a	PK-2026-010	Porto - Viena	active	{"dates": {"endDate": "2026-12-14", "startDate": "2026-12-11", "durationDays": 4, "durationNights": 3}, "lodging": [{"id": "hotel-1", "name": "Ruby Marie Hotel Vienna by IHG", "mealPlan": "pequeno-almoço", "destination": "Viena"}], "financials": {"profit": 145, "currency": "EUR", "salePrice": 1160, "totalCost": 1015, "components": [{"id": "cost_hotelName_1789567030736_ngyk", "amount": 705, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Ruby Marie Hotel Vienna by IHG", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "Ruby Marie Hotel Vienna by IHG"}, {"id": "cost_outboundRoute_1789567045476_1p1d", "notes": "15:05 - 19:20", "amount": 70, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "Ryanair (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (OPO)"}, {"id": "cost_inboundRoute_1789567053394_0lbf", "notes": "07:10 - 09:35", "amount": 70, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "Ryanair (VIE)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (VIE)"}, {"id": "cost_1789567141144_uqfjc", "notes": "IATI", "amount": 15, "category": "services", "currency": "EUR", "quantity": 2, "description": "Seguro-viagem", "isCustomized": true}], "priceTotal": {"amount": 1160, "currency": "EUR"}, "profitPercent": 12.5, "pricePerPerson": 580, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 580, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "inboundTransport": {"type": "flight", "route": "Ryanair (VIE)"}, "outboundTransport": {"type": "flight", "route": "Ryanair (OPO)"}}	EUR	2026-09-16 14:06:42.878615+00	2026-09-16 14:34:50.011946+00
c7a383e8-0ef6-4035-9e1d-3fdbbd8bbef9	PK-2026-008	Porto - Budapeste	active	{"dates": {"endDate": "2026-11-27", "startDate": "2026-11-24", "durationDays": 4, "durationNights": 3}, "services": [{"id": "66f4b0a4-2f7d-46db-8df4-f3d46398b010", "type": "outbound_transport", "amount": 67, "carrier": "KLM", "currency": "EUR", "quantity": 2, "arrivalTime": "11:30", "description": "OPO–BUD | KLM", "sourceField": "outboundRoute", "isCustomized": false, "departureTime": "05:00", "legacyCategory": "outbound_transport", "legacyComponentId": "cost_outboundRoute_1789561436620_7kc5"}, {"id": "8101d9d1-e1a5-4c09-9d65-512139c23b74", "type": "inbound_transport", "amount": 67, "carrier": "Ryanair", "currency": "EUR", "quantity": 2, "arrivalTime": "17:20", "description": "BUD–OPO | Ryanair", "sourceField": "inboundRoute", "isCustomized": false, "departureTime": "15:45", "legacyCategory": "inbound_transport", "legacyComponentId": "cost_inboundRoute_1789561436620_yn7l"}, {"id": "077f1c0d-6dcc-4b3d-a11a-3d9fef117dd1", "type": "accommodation", "amount": 210, "currency": "EUR", "mealPlan": "Café da manhã (BB)", "quantity": 1, "description": "Six Inn Hotel", "destination": "Budapeste", "sourceField": "hotelName", "isCustomized": false, "legacyCategory": "lodging", "legacyComponentId": "cost_hotelName_1789561460504_bwxh"}, {"id": "6d43ee4a-46aa-424c-922f-ad47cac79cda", "type": "insurance", "notes": "Maldy", "amount": 17.2, "currency": "EUR", "quantity": 2, "description": "Seguro-viagem", "isCustomized": true, "legacyCategory": "services", "legacyComponentId": "cost_1789561571277_26toq"}], "financials": {"profit": 67.6, "currency": "EUR", "salePrice": 580, "totalCost": 512.4, "components": [{"id": "66f4b0a4-2f7d-46db-8df4-f3d46398b010", "amount": 67, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "OPO–BUD | KLM", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "OPO–BUD | KLM"}, {"id": "8101d9d1-e1a5-4c09-9d65-512139c23b74", "amount": 67, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "BUD–OPO | Ryanair", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "BUD–OPO | Ryanair"}, {"id": "077f1c0d-6dcc-4b3d-a11a-3d9fef117dd1", "amount": 210, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Six Inn Hotel", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "Six Inn Hotel"}, {"id": "6d43ee4a-46aa-424c-922f-ad47cac79cda", "notes": "Maldy", "amount": 17.2, "category": "services", "currency": "EUR", "quantity": 2, "description": "Seguro-viagem", "isCustomized": true, "inheritedDescription": "Seguro-viagem"}], "priceTotal": {"amount": 580, "currency": "EUR"}, "profitPercent": 11.66, "pricePerPerson": 290, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 290, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "destination": "Budapeste", "additionalInfo": "Tx.local: 7€"}	EUR	2026-09-16 12:28:20.753351+00	2026-09-16 23:40:23.095675+00
6d2b2b19-b325-46bc-a2f3-2586309f3680	PK-2026-009	Porto - Praga	active	{"dates": {"endDate": "2026-12-15", "startDate": "2026-12-12", "durationDays": 4, "durationNights": 3}, "services": [{"id": "e79530bb-f25c-43d2-9948-f334c6e52fcd", "type": "outbound_transport", "amount": 130, "carrier": "easyJet", "currency": "EUR", "quantity": 2, "arrivalTime": "11:25", "description": "OPO–PRG | easyJet", "sourceField": "outboundRoute", "isCustomized": false, "departureTime": "07:15", "legacyCategory": "outbound_transport", "legacyComponentId": "cost_outboundRoute_1789562825416_5h67"}, {"id": "4d9a6c41-7a21-4a60-9354-053c8d495f55", "type": "inbound_transport", "amount": 130, "carrier": "easyJet", "currency": "EUR", "quantity": 2, "arrivalTime": "15:10", "description": "PRG–OPO | easyJet", "sourceField": "inboundRoute", "isCustomized": false, "departureTime": "12:50", "legacyCategory": "inbound_transport", "legacyComponentId": "cost_inboundRoute_1789562825416_iiz1"}, {"id": "de2b2a76-cc60-44f0-bc37-aec56cdc6df2", "type": "accommodation", "amount": 320, "currency": "EUR", "mealPlan": "Café da manhã (BB)", "quantity": 1, "description": "Hotel Brixen", "destination": "Praga", "sourceField": "hotelName", "isCustomized": false, "legacyCategory": "lodging", "legacyComponentId": "cost_hotelName_1789562850713_1c1o"}, {"id": "a60bffa8-d068-4397-bb09-140ab76f9ffe", "type": "insurance", "notes": "Mawdy", "amount": 17.2, "currency": "EUR", "quantity": 2, "description": "Seguro-viagem", "isCustomized": true, "legacyCategory": "services", "legacyComponentId": "cost_1789562923917_kkau3"}], "financials": {"profit": 124.6, "currency": "EUR", "salePrice": 999, "totalCost": 874.4, "components": [{"id": "e79530bb-f25c-43d2-9948-f334c6e52fcd", "amount": 130, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "OPO–PRG | easyJet", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "OPO–PRG | easyJet"}, {"id": "4d9a6c41-7a21-4a60-9354-053c8d495f55", "amount": 130, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "PRG–OPO | easyJet", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "PRG–OPO | easyJet"}, {"id": "de2b2a76-cc60-44f0-bc37-aec56cdc6df2", "amount": 320, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Hotel Brixen", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "Hotel Brixen"}, {"id": "a60bffa8-d068-4397-bb09-140ab76f9ffe", "notes": "Mawdy", "amount": 17.2, "category": "services", "currency": "EUR", "quantity": 2, "description": "Seguro-viagem", "isCustomized": true, "inheritedDescription": "Seguro-viagem"}], "priceTotal": {"amount": 999, "currency": "EUR"}, "profitPercent": 12.47, "pricePerPerson": 499.5, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 499.5, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "destination": "Praga", "additionalInfo": "Tx.local: 13€"}	EUR	2026-09-16 12:50:53.273978+00	2026-09-16 23:12:25.982581+00
\.


--
-- Data for Name: package_website_contents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."package_website_contents" ("id", "package_id", "content", "markdown", "filename", "created_at", "updated_at") FROM stdin;
15de8be7-ea72-47c9-b5b5-985e79031ce0	5aa77ff7-815b-442b-b9d2-80884b82728a	{"slug": "porto-viena-natal-2026", "price": 1160, "sobre": {"text": "Viena é a deslumbrante capital da Áustria, famosa por sua arquitetura imperial, palácios lendários como o Schönbrunn e o Hofburg, e uma tradição musical sem igual. Caminhar por suas avenidas elegantes e relaxar em seus icônicos cafés vienenses saboreando uma tradicional torta Sacher é mergulhar em séculos de história e charme.\\n\\nAliando tradição e modernidade, Viena oferece museus renomados, uma vida noturna animada e distritos cheios de vida. Sua estada em um estiloso Hotel de Viena, be localizado, garante a combinação perfeita de conveniência, design contemporâneo e localização central.", "image": "https://worldtraveltoucan.com/wp-content/uploads/2026/02/Untitled-1-2-1024x695.jpg", "title": "Sobre Viena"}, "title": "Natal 2026 em Viena", "origem": "Porto", "duracao": "4 dias", "excerpt": "Encante-se com a grandiosidade de Viena em uma viagem inesquecível. Inclui voos, seguro-viagem e hospedagem.", "incluso": [{"desc": "Trechos de ida e volta conforme os serviços contratados para a viagem.", "icon": "plane-departure", "title": "Passagens aéreas"}, {"desc": "Hospedagem com pequeno-almoço.", "icon": "hotel", "title": "Hospedagem"}, {"desc": "Seguro-viagem.", "icon": "shield-check", "title": "Seguro-viagem"}, {"desc": "Nossas dicas práticas.", "icon": "gift", "title": "Guia exclusivo S23"}], "category": "Europa", "ctaLabel": "Quero viajar", "featured": false, "seoTitle": "Pacote Viena Natal 2026 580€ - S23", "subtitle": "Viva o charme dos palácios imperiais e a vibração cultural de Viena com total conforto.", "cardImage": "https://ik.imagekit.io/s23travel/Pacotes/Featured-Image-Christkindlmarkt-Rathausplatz-Christmas-market-Vienna-Austria-things-to-do-Travel-Guide-copy.jpg", "heroImage": "https://ik.imagekit.io/s23travel/Pacotes/rathaus-wien-19-scaled.jpg", "pagamento": {"valor": "580 €", "formas": [], "observacao": "Valor por pessoa. Consulte-nos sobre personalizações, pagamento parcelado ou em outras moedas."}, "published": true, "naoIncluso": [], "infoDestino": {"clima": "Clima continental moderado, com invernos frios (médias de 0°C a 4°C) e verões amenos a quentes (médias de 20°C a 27°C).", "localizacao": "Capital da Áustria, situada na região leste do país, às margens do Rio Danúbio, no coração da Europa Central.", "documentacao": "", "idiomaCultura": "Idioma oficial: Alemão. Cultura rica marcada pela música clássica (terra de Mozart e Beethoven), arte impressionante e a clássica cultura dos cafés."}, "imagemDestaque": "https://ik.imagekit.io/s23travel/Pacotes/images_q=tbn:ANd9GcQBOmKsroDnFBnCE9nkuc6lLW3lITVGLSMy9VHY7c7CtwZpmI-bO3CP0_M-&s=10", "seoDescription": "Viaje para Viena com a S23 Agência de Viagens. Inclui voos Ryanair, hospedagem no Ruby Marie Hotel com café da manhã e seguro-viagem por 1160 EUR."}	---\ntitle: "Natal 2026 em Viena"\nslug: "porto-viena-natal-2026"\ncategory: "Europa"\nheroImage: "https://ik.imagekit.io/s23travel/Pacotes/rathaus-wien-19-scaled.jpg"\ncardImage: "https://ik.imagekit.io/s23travel/Pacotes/Featured-Image-Christkindlmarkt-Rathausplatz-Christmas-market-Vienna-Austria-things-to-do-Travel-Guide-copy.jpg"\nprice: 1160\nexcerpt: "Encante-se com a grandiosidade de Viena em uma viagem inesquecível. Inclui voos, seguro-viagem e hospedagem."\npublished: true\nfeatured: false\nsubtitle: "Viva o charme dos palácios imperiais e a vibração cultural de Viena com total conforto."\nduracao: "4 dias"\norigem: "Porto"\nctaLabel: "Quero viajar"\nimagemDestaque: "https://ik.imagekit.io/s23travel/Pacotes/images_q=tbn:ANd9GcQBOmKsroDnFBnCE9nkuc6lLW3lITVGLSMy9VHY7c7CtwZpmI-bO3CP0_M-&s=10"\nincluso:\n  - icon: "plane-departure"\n    title: "Passagens aéreas"\n    desc: "Trechos de ida e volta conforme os serviços contratados para a viagem."\n  - icon: "hotel"\n    title: "Hospedagem"\n    desc: "Hospedagem com pequeno-almoço."\n  - icon: "shield-check"\n    title: "Seguro-viagem"\n    desc: "Seguro-viagem."\n  - icon: "gift"\n    title: "Guia exclusivo S23"\n    desc: "Nossas dicas práticas."\nsobre:\n  title: "Sobre Viena"\n  text: "Viena é a deslumbrante capital da Áustria, famosa por sua arquitetura imperial, palácios lendários como o Schönbrunn e o Hofburg, e uma tradição musical sem igual. Caminhar por suas avenidas elegantes e relaxar em seus icônicos cafés vienenses saboreando uma tradicional torta Sacher é mergulhar em séculos de história e charme.\\n\\nAliando tradição e modernidade, Viena oferece museus renomados, uma vida noturna animada e distritos cheios de vida. Sua estada em um estiloso Hotel de Viena, be localizado, garante a combinação perfeita de conveniência, design contemporâneo e localização central."\n  image: "https://worldtraveltoucan.com/wp-content/uploads/2026/02/Untitled-1-2-1024x695.jpg"\ninfoDestino:\n  localizacao: "Capital da Áustria, situada na região leste do país, às margens do Rio Danúbio, no coração da Europa Central."\n  idiomaCultura: "Idioma oficial: Alemão. Cultura rica marcada pela música clássica (terra de Mozart e Beethoven), arte impressionante e a clássica cultura dos cafés."\n  clima: "Clima continental moderado, com invernos frios (médias de 0°C a 4°C) e verões amenos a quentes (médias de 20°C a 27°C)."\npagamento:\n  valor: "580 €"\n  observacao: "Valor por pessoa. Consulte-nos sobre personalizações, pagamento parcelado ou em outras moedas."\nseoTitle: "Pacote Viena Natal 2026 580€ - S23"\nseoDescription: "Viaje para Viena com a S23 Agência de Viagens. Inclui voos Ryanair, hospedagem no Ruby Marie Hotel com café da manhã e seguro-viagem por 1160 EUR."\n---\n\nViena é a deslumbrante capital da Áustria, famosa por sua arquitetura imperial, palácios lendários como o Schönbrunn e o Hofburg, e uma tradição musical sem igual. Caminhar por suas avenidas elegantes e relaxar em seus icônicos cafés vienenses saboreando uma tradicional torta Sacher é mergulhar em séculos de história e charme.\n\nAliando tradição e modernidade, Viena oferece museus renomados, uma vida noturna animada e distritos cheios de vida. Sua estada em um estiloso Hotel de Viena, be localizado, garante a combinação perfeita de conveniência, design contemporâneo e localização central.\n	porto-viena-natal-2026.md	2026-09-17 08:04:22.208098+00	2026-09-17 08:06:09.387748+00
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."quotations" ("id", "package_id", "reference", "client_name", "status", "data", "currency", "exchange_rate", "exchange_rate_date", "created_at", "updated_at") FROM stdin;
2e46dc66-6b08-461f-a981-fe9e420c474e	\N	COT-2026-002	Jorge Oliveira	sent	{"dates": {"endDate": "2026-10-06", "startDate": "2026-10-02", "durationDays": 5, "durationNights": 4}, "lodging": [{"id": "hotel-quote-1", "name": "Apartamentos Malibu Park", "mealPlan": "Café da manhã (BB)", "destination": "Tenerife"}], "financials": {"profit": 335.6, "currency": "EUR", "salePrice": 2900, "totalCost": 2564.4, "components": [{"id": "cost_hotelName_1789478304735_7don", "amount": 1178, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Apartamentos Malibu Park", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "Apartamentos Malibu Park"}, {"id": "cost_outboundRoute_1789478535959_r23t", "amount": 173.3, "category": "outbound_transport", "currency": "EUR", "quantity": 4, "description": "Iberia (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Iberia (OPO)"}, {"id": "cost_inboundRoute_1789478535959_x6a7", "amount": 173.3, "category": "inbound_transport", "currency": "EUR", "quantity": 4, "description": "Ryanair (TFS)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (TFS)"}], "priceTotal": {"amount": 2900, "currency": "EUR"}, "profitPercent": 11.57, "pricePerPerson": 725, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 725, "currency": "EUR"}}, "passengers": {"adults": 4, "infants": 0, "children": 0}, "inboundTransport": {"type": "flight", "route": "Ryanair (TFS)", "carrier": "Ryanair", "arrivalTime": "21:55", "departureTime": "19:20"}, "outboundTransport": {"type": "flight", "route": "Iberia (OPO)", "carrier": "Iberia", "arrivalTime": "02:05", "departureTime": "20:40"}}	EUR	\N	\N	2026-09-14 18:09:33.102394+00	2026-09-15 13:22:46.257437+00
f0307578-0783-49bc-b445-520db26b3714	aaff77e6-3f8a-4379-a3e3-3d044331266b	COT-2026-008	Ricardo Ferreira	sent	{"dates": {"endDate": "2026-10-22", "startDate": "2026-10-19", "durationDays": 4, "durationNights": 3}, "services": [{"id": "e1fea3e7-a9b9-4f63-935d-31aa43e41bf8", "type": "outbound_transport", "amount": 24, "currency": "EUR", "quantity": 4, "arrivalTime": "16:30", "description": "Ryanair (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "departureTime": "13:40", "legacyCategory": "outbound_transport", "legacyComponentId": "cost_outboundRoute_1789388054492_2eqz"}, {"id": "bde246c1-51f9-4bcf-89c1-cd067918082e", "type": "inbound_transport", "amount": 24, "currency": "EUR", "quantity": 4, "arrivalTime": "23:15", "description": "Ryanair (PMI)", "sourceField": "inboundRoute", "isCustomized": false, "departureTime": "22:20", "legacyCategory": "inbound_transport", "legacyComponentId": "cost_inboundRoute_1789388057400_4rpv"}, {"id": "1de66b7d-31ab-4b08-a82f-0b315ee9f88b", "type": "accommodation", "notes": "2x standart casal quarto", "amount": 534, "currency": "EUR", "mealPlan": "Café da manhã (BB)", "quantity": 1, "description": "tent Bahia de Palma", "destination": "Maiorca", "sourceField": "hotelName", "isCustomized": false, "legacyCategory": "lodging", "legacyComponentId": "cost_hotelName_1789388066375_jcw2"}], "financials": {"profit": 88, "currency": "EUR", "salePrice": 814, "totalCost": 726, "components": [{"id": "e1fea3e7-a9b9-4f63-935d-31aa43e41bf8", "amount": 24, "category": "outbound_transport", "currency": "EUR", "quantity": 4, "description": "Ryanair (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (OPO)"}, {"id": "bde246c1-51f9-4bcf-89c1-cd067918082e", "amount": 24, "category": "inbound_transport", "currency": "EUR", "quantity": 4, "description": "Ryanair (PMI)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (PMI)"}, {"id": "1de66b7d-31ab-4b08-a82f-0b315ee9f88b", "notes": "2x standart casal quarto", "amount": 534, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "tent Bahia de Palma", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "tent Bahia de Palma"}], "priceTotal": {"amount": 814, "currency": "EUR"}, "profitPercent": 10.81, "pricePerPerson": 203.5, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 203.5, "currency": "EUR"}}, "passengers": {"adults": 4, "infants": 0, "children": 0}, "destination": "Maiorca", "localTaxNotes": "27", "originPackageName": "Porto - Maiorca", "paymentConditions": "195 de sinal + restante até 09/10/2016"}	EUR	\N	\N	2026-09-17 14:32:07.6803+00	2026-09-18 18:00:03.175117+00
e0e1f4b6-13f0-4f57-9624-c4da7bb8d950	\N	COT-2026-001	Jorge Oliveira	sent	{"dates": {"endDate": "2026-10-06", "startDate": "2026-10-02", "durationDays": 5}, "lodging": [{"id": "hotel-quote-1", "name": "tent Bahia de Palma", "mealPlan": "Café da manhã (BB)", "destination": "Palma de Maiorca"}], "financials": {"profit": 195, "currency": "EUR", "salePrice": 2000, "totalCost": 1805, "components": [{"id": "cost_1789408532080_5bgec", "notes": "Apenas mochila", "amount": 112.5, "category": "outbound_transport", "currency": "EUR", "quantity": 4, "description": "Easyjet (OPO)", "isCustomized": true}, {"id": "cost_1789408576832_hd80b", "notes": "Apenas mochila", "amount": 112.5, "category": "inbound_transport", "currency": "EUR", "quantity": 4, "description": "Ryanair (PMI)", "isCustomized": true}, {"id": "cost_1789408594552_ufbvh", "notes": "BB", "amount": 905, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "tent Bahia de Palma", "isCustomized": true}], "priceTotal": {"amount": 2000, "currency": "EUR"}, "profitPercent": 9.75, "pricePerPerson": 500, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 500, "currency": "EUR"}}, "passengers": {"adults": 4, "infants": 0, "children": 0}, "localTaxNotes": "Tx.local: 36€", "inboundTransport": {"type": "flight", "route": "Ryanair (PMI)", "arrivalTime": "14:35", "departureTime": "13:40"}, "outboundTransport": {"type": "flight", "route": "Easyjet (OPO)", "arrivalTime": "11:20", "departureTime": "08:35"}}	EUR	\N	\N	2026-09-14 17:58:42.20696+00	2026-09-14 19:25:50.513767+00
60a07261-4a2a-4406-87e8-366ce3f113db	\N	COT-2026-004	Paula Moreira	sent	{"dates": {"endDate": "2026-11-28", "startDate": "2026-11-21", "durationDays": 7}, "lodging": [{"id": "hotel-quote-1", "name": "Playa Real Resort", "mealPlan": "Tudo incluído (AI)", "destination": "Tenerife"}], "financials": {"profit": 255, "currency": "EUR", "salePrice": 2160, "totalCost": 1905, "components": [{"id": "quote-outbound-1789412152846", "notes": "", "amount": 80, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "OPO–TFS | Ryanair"}, {"id": "quote-inbound-1789412152847", "amount": 80, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "TFS–OPO | Ryanair"}, {"id": "quote-lodging-1789412152847", "amount": 1585, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Playa Real Resort"}], "priceTotal": {"amount": 2160, "currency": "EUR"}, "profitPercent": 11.81, "pricePerPerson": 1080, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 1080, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "inboundTransport": {"type": "flight", "route": "TFS–OPO | Ryanair", "carrier": "Ryanair", "arrivalTime": "12:15", "departureTime": "09:35"}, "outboundTransport": {"type": "flight", "route": "OPO–TFS | Ryanair", "carrier": "Ryanair", "arrivalTime": "08:55", "departureTime": "06:15"}, "paymentConditions": "Entrada: 320€ + restante até 10/11"}	EUR	\N	\N	2026-09-14 18:59:26.145006+00	2026-09-14 19:26:44.876161+00
042d5004-deec-495f-8abe-5444c298769e	\N	COT-2026-003	Paula Moreira	sent	{"dates": {"endDate": "2026-11-28", "startDate": "2026-11-21", "durationDays": 7}, "lodging": [{"id": "hotel-quote-1", "name": "Paradise Bay Resort", "mealPlan": "Tudo incluído (AI)", "destination": "Malta"}], "financials": {"profit": 200, "currency": "EUR", "salePrice": 1650, "totalCost": 1450, "components": [{"id": "quote-outbound-1789411293023", "amount": 147, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "OPO–MLA | Lufthansa"}, {"id": "quote-inbound-1789411293023", "amount": 147, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "MLA–OPO | KM Malta Airlines", "isCustomized": true}, {"id": "quote-lodging-1789411293023", "notes": "TI", "amount": 862, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Paradise Bay Resort"}], "priceTotal": {"amount": 1650, "currency": "EUR"}, "profitPercent": 12.12, "pricePerPerson": 825, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 825, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "localTaxNotes": "21€", "inboundTransport": {"type": "flight", "route": "MLA–OPO | KM Malta Airlines", "carrier": "KM Malta Airlines, Lufthansa", "arrivalTime": "23:40", "departureTime": "16:10"}, "outboundTransport": {"type": "flight", "route": "OPO–MLA | Lufthansa", "carrier": "Lufthansa", "arrivalTime": "13:00", "departureTime": "06:00"}, "paymentConditions": "Entrada: 1100€ + restante até 10/11"}	EUR	\N	\N	2026-09-14 18:45:12.142439+00	2026-09-14 19:25:59.603012+00
db7028b6-97ba-48b9-8e72-4b32dc9c40b3	\N	COT-2026-005	Paula Moreira	sent	{"dates": {"endDate": "2026-11-29", "startDate": "2026-11-22", "durationDays": 7}, "lodging": [{"id": "hotel-quote-1", "name": "Hotel Riu Touareg - All Inclusive", "mealPlan": "Tudo incluído (AI)", "destination": "Cabo Verde"}], "financials": {"profit": 261, "currency": "EUR", "salePrice": 2170, "totalCost": 1909, "components": [{"id": "quote-outbound-1789413517220", "notes": "Mala de cabine", "amount": 133, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "Porto a Boa Vista | EJU6871"}, {"id": "quote-inbound-1789413517220", "notes": "Mala de cabine", "amount": 133, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "Boa Vista a Porto | EJU6872"}, {"id": "quote-lodging-1789413517220", "notes": "", "amount": 1377, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Hotel Riu Touareg - All Inclusive"}], "priceTotal": {"amount": 2170, "currency": "EUR"}, "profitPercent": 12.03, "pricePerPerson": 1085, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 1085, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "inboundTransport": {"type": "flight", "route": "Boa Vista a Porto | Easyjet", "arrivalTime": "16:05", "departureTime": "10:40"}, "outboundTransport": {"type": "flight", "route": "Porto a Boa Vista | Easyjet", "arrivalTime": "09:50", "departureTime": "06:20"}, "paymentConditions": "Entrada: 530€ + restante até 10/11"}	EUR	\N	\N	2026-09-14 19:20:56.972296+00	2026-09-14 19:28:55.678744+00
ef89f208-c390-4a09-94a4-a5a1e0fc51b0	\N	COT-2026-006	Gina	sent	{"dates": {"endDate": "2027-04-27", "startDate": "2027-04-23", "durationDays": 6}, "lodging": [{"id": "hotel-quote-1", "name": "Hotel Best 4 Barcelona", "mealPlan": "Meia-pensão (HB)", "destination": "Barcelona"}], "financials": {"profit": 211, "currency": "EUR", "salePrice": 1699, "totalCost": 1488, "components": [{"id": "quote-outbound-1789415532779", "amount": 100, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "OPO → BCN"}, {"id": "quote-inbound-1789415532779", "amount": 100, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "BCN → OPO"}, {"id": "quote-lodging-1789415532779", "notes": "Meia-pensão", "amount": 810, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "Hotel Best 4 Barcelona"}, {"id": "cost_1789415689101_aax9y", "notes": "26/04 - Getyourguide", "amount": 278, "category": "services", "currency": "EUR", "quantity": 1, "description": "Visita guiada de 4h, com bilhetes, para a Sagrada Família + Parque Güell", "isCustomized": true}], "priceTotal": {"amount": 1699, "currency": "EUR"}, "profitPercent": 12.42, "pricePerPerson": 849.5, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 849.5, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "localTaxNotes": "74€", "inboundTransport": {"type": "flight", "route": "BCN → OPO", "arrivalTime": "16:15", "departureTime": "15:15"}, "outboundTransport": {"type": "flight", "route": "OPO → BCN", "arrivalTime": "11:35", "departureTime": "08:45"}, "paymentConditions": "400€ + restante até 10/04"}	EUR	\N	\N	2026-09-14 19:57:19.719125+00	2026-09-14 20:04:46.316677+00
d3c3c2a6-566e-49c7-97dc-8d8f6c87f48b	aaff77e6-3f8a-4379-a3e3-3d044331266b	COT-2026-009	Ivo Pinto	accepted	{"dates": {"endDate": "2026-10-22", "startDate": "2026-10-19", "durationDays": 4, "durationNights": 3}, "services": [{"id": "1da9ebb9-5161-4a6a-b407-363e1fade276", "type": "outbound_transport", "amount": 22, "currency": "EUR", "quantity": 4, "arrivalTime": "23:40", "description": "Ryanair (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "departureTime": "20:50", "legacyCategory": "outbound_transport", "legacyComponentId": "cost_outboundRoute_1789388054492_2eqz"}, {"id": "be8d9b90-8aab-4c04-96e6-8455b108538c", "type": "inbound_transport", "amount": 22, "currency": "EUR", "quantity": 4, "arrivalTime": "23:15", "description": "Ryanair (PMI)", "sourceField": "inboundRoute", "isCustomized": false, "departureTime": "22:20", "legacyCategory": "inbound_transport", "legacyComponentId": "cost_inboundRoute_1789388057400_4rpv"}, {"id": "3cde3997-18f7-4a96-9b17-ae63ec274d63", "type": "accommodation", "amount": 246, "currency": "EUR", "mealPlan": "Café da manhã (BB)", "quantity": 1, "description": "tent Calvia Beach", "destination": "Maiorca", "sourceField": "hotelName", "isCustomized": false, "legacyCategory": "lodging", "legacyComponentId": "cost_hotelName_1789388066375_jcw2"}], "financials": {"profit": 128, "currency": "EUR", "salePrice": 550, "totalCost": 422, "components": [{"id": "1da9ebb9-5161-4a6a-b407-363e1fade276", "amount": 22, "category": "outbound_transport", "currency": "EUR", "quantity": 4, "description": "Ryanair (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (OPO)"}, {"id": "be8d9b90-8aab-4c04-96e6-8455b108538c", "amount": 22, "category": "inbound_transport", "currency": "EUR", "quantity": 4, "description": "Ryanair (PMI)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Ryanair (PMI)"}, {"id": "3cde3997-18f7-4a96-9b17-ae63ec274d63", "amount": 246, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "tent Calvia Beach", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "tent Calvia Beach"}], "priceTotal": {"amount": 550, "currency": "EUR"}, "profitPercent": 23.27, "pricePerPerson": 137.5, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 137.5, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 2}, "destination": "Maiorca", "localTaxNotes": "14€", "originPackageName": "Porto - Maiorca", "paymentConditions": "180€ + restante até 10/10"}	EUR	\N	\N	2026-09-18 16:28:18.690467+00	2026-09-18 18:00:24.325723+00
59d6295e-205d-4ca3-aa98-ea01a9d2c08f	1d7db3ec-a142-40cc-b409-099b6330858f	COT-2026-010	Helena Cardoso	draft	{"dates": {"endDate": "2027-01-02", "startDate": "2026-12-31", "durationDays": 3, "durationNights": 2}, "services": [{"id": "667fca92-f173-4ae7-a4ac-7c7ffb9462de", "type": "outbound_transport", "notes": "Mochila", "amount": 78, "carrier": "Transavia", "currency": "EUR", "quantity": 2, "arrivalTime": "11:30", "description": "OPO - ORY | Transavia", "departureTime": "08:15"}, {"id": "8809a0db-6212-4dd1-80bc-b8f4cc7938bc", "type": "inbound_transport", "notes": "Mochila", "amount": 78, "carrier": "Transavia", "currency": "EUR", "quantity": 2, "arrivalTime": "08:05", "description": "ORY - OPO | Transavia", "departureTime": "06:45"}, {"id": "48cec26e-a244-40b9-bf64-c13fe6533fc4", "type": "accommodation", "amount": 237, "currency": "EUR", "mealPlan": "Apenas alojamento (RO)", "quantity": 1, "description": "ibis Paris Alésia Montparnasse 14ème", "destination": "Paris"}], "financials": {"profit": 81, "currency": "EUR", "salePrice": 630, "totalCost": 549, "components": [{"id": "667fca92-f173-4ae7-a4ac-7c7ffb9462de", "notes": "Mochila", "amount": 78, "category": "outbound_transport", "currency": "EUR", "quantity": 2, "description": "OPO - ORY | Transavia", "inheritedDescription": "OPO - ORY | Transavia"}, {"id": "8809a0db-6212-4dd1-80bc-b8f4cc7938bc", "notes": "Mochila", "amount": 78, "category": "inbound_transport", "currency": "EUR", "quantity": 2, "description": "ORY - OPO | Transavia", "inheritedDescription": "ORY - OPO | Transavia"}, {"id": "48cec26e-a244-40b9-bf64-c13fe6533fc4", "amount": 237, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "ibis Paris Alésia Montparnasse 14ème", "inheritedDescription": "ibis Paris Alésia Montparnasse 14ème"}], "priceTotal": {"amount": 630, "currency": "EUR"}, "profitPercent": 12.86, "pricePerPerson": 315, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 315, "currency": "EUR"}}, "passengers": {"adults": 2, "infants": 0, "children": 0}, "customNotes": "Voo de volta saindo 17:35h: +37€ por pessoa, sendo entrada de 385€", "destination": "Paris", "localTaxNotes": "23€", "originPackageName": "Porto - Paris Reveillon 2027", "paymentConditions": "300€ + restante até dia 20/12"}	EUR	\N	\N	2026-09-18 20:10:43.334725+00	2026-09-18 20:21:13.525446+00
fbdab07b-644c-4f58-ae7b-5e4d944e066c	7bcef242-25b2-4e47-ba16-f8dc3bb385d5	COT-2026-011	Gleide Alves - Messenger	sent	{"dates": {"endDate": "2026-11-30", "startDate": "2026-11-27", "durationDays": 4, "durationNights": 3}, "services": [{"id": "1c75de21-1a35-4379-9c36-fac00c0a2240", "type": "outbound_transport", "amount": 65.5, "currency": "EUR", "quantity": 4, "arrivalTime": "15:40", "description": "Easyjet (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "departureTime": "12:25", "legacyCategory": "outbound_transport", "legacyComponentId": "cost_outboundRoute_1789381853062_r8l6"}, {"id": "2362e75b-5c51-46c5-9a5d-3894caf21836", "type": "inbound_transport", "amount": 65.5, "currency": "EUR", "quantity": 4, "arrivalTime": "15:05", "description": "Transavia (ORY)", "sourceField": "inboundRoute", "isCustomized": false, "departureTime": "13:45", "legacyCategory": "inbound_transport", "legacyComponentId": "cost_inboundRoute_1789381856620_kptd"}, {"id": "f5e2e5bc-19d3-416d-b366-959d4cd00ea2", "type": "accommodation", "notes": "2 Qto.duplo Std", "amount": 545, "currency": "EUR", "mealPlan": "Apenas alojamento (RO)", "quantity": 1, "description": "B&B HOTEL Paris Porte de Bagnolet", "destination": "Paris", "sourceField": "hotelName", "isCustomized": false, "legacyCategory": "lodging", "legacyComponentId": "cost_hotelName_1789381826931_bvel"}, {"id": "879e739f-18ae-4dc7-8874-4fd2502191f1", "type": "additional", "notes": "29/11", "amount": 330, "currency": "EUR", "quantity": 1, "description": "Bilhete Disneyland Paris 1 dia", "isCustomized": true, "legacyCategory": "services", "legacyComponentId": "cost_1789382169854_rydl3"}], "financials": {"profit": 200, "currency": "EUR", "salePrice": 1599, "totalCost": 1399, "components": [{"id": "1c75de21-1a35-4379-9c36-fac00c0a2240", "amount": 65.5, "category": "outbound_transport", "currency": "EUR", "quantity": 4, "description": "Easyjet (OPO)", "sourceField": "outboundRoute", "isCustomized": false, "inheritedDescription": "Easyjet (OPO)"}, {"id": "2362e75b-5c51-46c5-9a5d-3894caf21836", "amount": 65.5, "category": "inbound_transport", "currency": "EUR", "quantity": 4, "description": "Transavia (ORY)", "sourceField": "inboundRoute", "isCustomized": false, "inheritedDescription": "Transavia (ORY)"}, {"id": "f5e2e5bc-19d3-416d-b366-959d4cd00ea2", "notes": "2 Qto.duplo Std", "amount": 545, "category": "lodging", "currency": "EUR", "quantity": 1, "description": "B&B HOTEL Paris Porte de Bagnolet", "sourceField": "hotelName", "isCustomized": false, "inheritedDescription": "B&B HOTEL Paris Porte de Bagnolet"}, {"id": "879e739f-18ae-4dc7-8874-4fd2502191f1", "notes": "29/11", "amount": 330, "category": "services", "currency": "EUR", "quantity": 1, "description": "Bilhete Disneyland Paris 1 dia", "isCustomized": true, "inheritedDescription": "Bilhete Disneyland Paris 1 dia"}], "priceTotal": {"amount": 1599, "currency": "EUR"}, "profitPercent": 12.51, "pricePerPerson": 399.75, "conversionError": null, "exchangeRateUsed": null, "taxesAndFeesTotal": 0, "pricePerPersonAmount": {"amount": 399.75, "currency": "EUR"}}, "passengers": {"adults": 3, "infants": 0, "children": 1}, "destination": "Paris", "localTaxNotes": "66€", "originPackageName": "Porto - Paris + Disney", "paymentConditions": "530€ + restante até 20/11"}	EUR	\N	\N	2026-09-21 14:33:13.583671+00	2026-09-21 14:47:27.37537+00
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type", "versioning_status") FROM stdin;
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_analytics" ("name", "type", "format", "created_at", "updated_at", "id", "deleted_at") FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_vectors" ("id", "type", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata", "archived_at", "is_delete_marker", "is_versioned") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads" ("id", "in_progress_size", "upload_signature", "bucket_id", "key", "version", "owner_id", "created_at", "user_metadata", "metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads_parts" ("id", "upload_id", "size", "part_number", "bucket_id", "key", "etag", "owner_id", "version", "created_at") FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."vector_indexes" ("id", "name", "bucket_id", "data_type", "dimension", "distance_metric", "metadata_configuration", "created_at", "updated_at") FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict XGcpsBDwrhvrG0JYb6cbJiPf1UQc18ec6sx6BpkBIxzcX4WwzvGFDdB2gER6mca

RESET ALL;
