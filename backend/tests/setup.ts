process.env.LLM_PROVIDER ??= "mock";
process.env.SESSION_SECRET ??= "test-secret-0123456789-abcdefghij-0123456789abcdef";
process.env.TEST_DATABASE_URL ??= "postgres://mih:mih@localhost:5432/mih_test";
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL;
process.env.DATA_DIR ??= ".test-data";
