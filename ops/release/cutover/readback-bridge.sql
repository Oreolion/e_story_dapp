-- Record-free operator evidence. Never select keys, digests or receipt payloads.
SELECT mode,epoch IS NOT NULL AS epoch_configured,octet_length(key_sha256)=32 AS digest_configured
FROM istory_release.control WHERE singleton;
SELECT status,count(*) AS receipts,min(received_at) AS oldest_received_at,
  count(*) FILTER(WHERE status='processing' AND lease_until<=clock_timestamp()) AS expired_leases
FROM istory_release.payment_callbacks GROUP BY status ORDER BY status;
SELECT count(*) FILTER(WHERE state IS NOT NULL AND state<>'idle') AS active_data_api_sessions,
  count(*) FILTER(WHERE state IS NULL) AS unknown_data_api_sessions
FROM pg_stat_activity WHERE usename='authenticator' AND pid<>pg_backend_pid();
