CREATE TABLE IF NOT EXISTS flow_client_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES flow_organizations(id) ON DELETE CASCADE,
  title varchar(180) NOT NULL,
  summary text NOT NULL,
  services text[] NOT NULL DEFAULT ARRAY[]::text[],
  deal_value numeric(12,2),
  currency varchar(3) NOT NULL DEFAULT 'EGP',
  status varchar(24) NOT NULL DEFAULT 'agreed',
  agreement_date date,
  contract_file_id uuid REFERENCES flow_files(id) ON DELETE SET NULL,
  contract_status varchar(24) NOT NULL DEFAULT 'not_uploaded',
  contract_start_date date,
  contract_end_date date,
  client_visible boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES flow_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flow_client_deals_org_date_idx ON flow_client_deals(organization_id, agreement_date);
CREATE INDEX IF NOT EXISTS flow_client_deals_status_idx ON flow_client_deals(status);
