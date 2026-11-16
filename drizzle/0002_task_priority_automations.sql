ALTER TABLE "flow_workflow_steps" ADD COLUMN IF NOT EXISTS "priority" varchar(16) NOT NULL DEFAULT 'normal';

CREATE TABLE IF NOT EXISTS "flow_automation_rules" (
  "key" varchar(60) PRIMARY KEY NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_by" uuid REFERENCES "flow_users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
