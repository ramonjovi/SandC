CREATE TABLE "rule_overrides" (
	"rule_id" text NOT NULL,
	"key" text NOT NULL,
	"value" real NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_overrides_rule_id_key_pk" PRIMARY KEY("rule_id","key")
);
