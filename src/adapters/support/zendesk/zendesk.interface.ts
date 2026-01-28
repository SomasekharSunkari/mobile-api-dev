/**
 * Zendesk API Response Types
 *
 * These interfaces represent the raw response structures from Zendesk's API.
 * They are used internally by the Zendesk adapter and transformed into
 * standardized formats defined in support.adapter.interface.ts
 */

export interface ZendeskTicket {
  id: number;
  url: string;
  external_id?: string;
  created_at: string;
  updated_at: string;
  type?: string;
  subject: string;
  raw_subject?: string;
  description: string;
  priority?: string;
  status: string;
  recipient?: string;
  requester_id: number;
  submitter_id?: number;
  assignee_id?: number;
  organization_id?: number;
  group_id?: number;
  collaborator_ids?: number[];
  follower_ids?: number[];
  email_cc_ids?: number[];
  forum_topic_id?: number;
  problem_id?: number;
  has_incidents: boolean;
  is_public: boolean;
  due_at?: string;
  tags?: string[];
  custom_fields?: ZendeskCustomField[];
  satisfaction_rating?: any;
  sharing_agreement_ids?: number[];
  fields?: ZendeskCustomField[];
  followup_ids?: number[];
  ticket_form_id?: number;
  brand_id?: number;
  allow_channelback: boolean;
  allow_attachments: boolean;
}

export interface ZendeskCustomField {
  id: number;
  value: any;
}

export interface ZendeskTicketComment {
  body: string;
  public?: boolean;
}

export interface ZendeskTicketRequester {
  name?: string;
  email: string;
}

export interface ZendeskCreateTicketData {
  subject: string;
  comment: ZendeskTicketComment;
  requester?: ZendeskTicketRequester;
  priority?: string;
  type?: string;
  tags?: string[];
  custom_fields?: ZendeskCustomField[];
}

export interface ZendeskCreateTicketRequest {
  ticket: ZendeskCreateTicketData;
}

export interface ZendeskUpdateTicketData {
  subject?: string;
  comment?: ZendeskTicketComment;
  priority?: string;
  type?: string;
  status?: string;
  tags?: string[];
  custom_fields?: ZendeskCustomField[];
}

export interface ZendeskUpdateTicketRequest {
  ticket: ZendeskUpdateTicketData;
}

export interface ZendeskCreateTicketResponse {
  ticket: ZendeskTicket;
}

export interface ZendeskGetTicketResponse {
  ticket: ZendeskTicket;
}

export interface ZendeskUpdateTicketResponse {
  ticket: ZendeskTicket;
}

export interface ZendeskComment {
  id: number;
  type: string;
  author_id: number;
  body: string;
  html_body?: string;
  plain_body?: string;
  public: boolean;
  attachments?: any[];
  audit_id?: number;
  created_at: string;
  metadata?: any;
}

export interface ZendeskAddCommentTicketData {
  comment: ZendeskTicketComment;
}

export interface ZendeskAddCommentRequest {
  ticket: ZendeskAddCommentTicketData;
}

export interface ZendeskAuditEvent {
  id: number;
  type: string;
  public: boolean;
  body?: string;
}

export interface ZendeskAudit {
  id: number;
  ticket_id: number;
  created_at: string;
  author_id: number;
  events: ZendeskAuditEvent[];
}

export interface ZendeskAddCommentResponse {
  ticket: ZendeskTicket;
  audit: ZendeskAudit;
}

export interface ZendeskUser {
  id: number;
  url: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
  time_zone: string;
  iana_time_zone: string;
  phone?: string;
  shared_phone_number?: boolean;
  photo?: any;
  locale_id: number;
  locale: string;
  organization_id?: number;
  role: string;
  verified: boolean;
  external_id?: string;
  tags?: string[];
  alias?: string;
  active: boolean;
  shared: boolean;
  shared_agent: boolean;
  last_login_at?: string;
  two_factor_auth_enabled: boolean;
  signature?: string;
  details?: string;
  notes?: string;
  role_type?: number;
  custom_role_id?: number;
  moderator: boolean;
  ticket_restriction?: string;
  only_private_comments: boolean;
  restricted_agent: boolean;
  suspended: boolean;
  chat_only: boolean;
  default_group_id?: number;
  report_csv: boolean;
  user_fields?: Record<string, any>;
}

export interface ZendeskJwtPayload {
  scope: string;
  external_id: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  exp?: number;
}
