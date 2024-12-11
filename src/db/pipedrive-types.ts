export type BaseUserMe = {
  id: number;
  name: string;
  default_currency: string;
  locale: string;
  lang: number;
  email: string;
  phone: null | string;
  last_login: string;
  created: string;
  modified: string;
  has_created_company: boolean;
  access: UserAccess[];
  active_flag: boolean;
  timezone_name: string;
  timezone_offset: string;
  role_id: number;
  icon_url: null | string;
  is_you: boolean;
  is_deleted: boolean;
  is_admin: number;
  company_id: number;
  company_name: string;
  company_domain: string;
  company_country: string;
  language: BaseUserMeLanguage;
}

export type UserAccess = {
  app: string;
  admin: boolean;
  permission_set_id: string;
}

export type BaseUserMeLanguage = {
  language_code: string;
  country_code: string;
}
