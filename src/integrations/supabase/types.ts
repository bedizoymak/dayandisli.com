export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounting_entries: {
        Row: {
          amount: number
          branch_id: string | null
          company_id: string | null
          created_at: string
          credit_account: string | null
          currency: string
          debit_account: string | null
          entry_type: string
          external_reference: string | null
          id: string
          invoice_id: string | null
          metadata: Json
          order_id: string | null
          payment_id: string | null
          provider: string | null
          refund_request_id: string | null
          status: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          credit_account?: string | null
          currency?: string
          debit_account?: string | null
          entry_type: string
          external_reference?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          order_id?: string | null
          payment_id?: string | null
          provider?: string | null
          refund_request_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          credit_account?: string | null
          currency?: string
          debit_account?: string | null
          entry_type?: string
          external_reference?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          order_id?: string | null
          payment_id?: string | null
          provider?: string | null
          refund_request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "shop_return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          role?: string
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          alert_id: string | null
          audit_log_id: string | null
          branch_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          event_id: string | null
          failure_reason: string | null
          id: string
          job_run_id: string | null
          max_retries: number
          metadata: Json
          module: string
          retry_count: number
          rule_id: string | null
          rule_key: string
          severity: string
          source: string
          started_at: string | null
          status: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          alert_id?: string | null
          audit_log_id?: string | null
          branch_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          event_id?: string | null
          failure_reason?: string | null
          id?: string
          job_run_id?: string | null
          max_retries?: number
          metadata?: Json
          module?: string
          retry_count?: number
          rule_id?: string | null
          rule_key: string
          severity?: string
          source?: string
          started_at?: string | null
          status?: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          alert_id?: string | null
          audit_log_id?: string | null
          branch_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          event_id?: string | null
          failure_reason?: string | null
          id?: string
          job_run_id?: string | null
          max_retries?: number
          metadata?: Json
          module?: string
          retry_count?: number
          rule_id?: string | null
          rule_key?: string
          severity?: string
          source?: string
          started_at?: string | null
          status?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "platform_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "erp_audit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "platform_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_job_run_id_fkey"
            columns: ["job_run_id"]
            isOneToOne: false
            referencedRelation: "scheduled_job_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: Json
          branch_id: string | null
          company_id: string
          condition: Json
          created_at: string
          description: string | null
          id: string
          last_triggered_at: string | null
          metadata: Json
          module: string
          name: string
          rule_key: string
          severity: string
          source: string
          status: string
          trigger_event: string
          updated_at: string
        }
        Insert: {
          action?: Json
          branch_id?: string | null
          company_id: string
          condition?: Json
          created_at?: string
          description?: string | null
          id?: string
          last_triggered_at?: string | null
          metadata?: Json
          module?: string
          name: string
          rule_key: string
          severity?: string
          source?: string
          status?: string
          trigger_event: string
          updated_at?: string
        }
        Update: {
          action?: Json
          branch_id?: string | null
          company_id?: string
          condition?: Json
          created_at?: string
          description?: string | null
          id?: string
          last_triggered_at?: string | null
          metadata?: Json
          module?: string
          name?: string
          rule_key?: string
          severity?: string
          source?: string
          status?: string
          trigger_event?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      commerce_checkout_events: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string | null
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          order_id: string | null
          user_agent: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          order_id?: string | null
          user_agent?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          order_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commerce_checkout_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          base_currency: string
          code: string
          created_at: string
          id: string
          legal_name: string
          primary_admin_email: string | null
          settings: Json
          status: string
          tax_number: string | null
          tax_office: string | null
          timezone: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          base_currency?: string
          code: string
          created_at?: string
          id?: string
          legal_name: string
          primary_admin_email?: string | null
          settings?: Json
          status?: string
          tax_number?: string | null
          tax_office?: string | null
          timezone?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          base_currency?: string
          code?: string
          created_at?: string
          id?: string
          legal_name?: string
          primary_admin_email?: string | null
          settings?: Json
          status?: string
          tax_number?: string | null
          tax_office?: string | null
          timezone?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_branches: {
        Row: {
          address_line: string | null
          city: string | null
          code: string
          company_id: string
          country: string
          created_at: string
          email: string | null
          id: string
          manager_email: string | null
          name: string
          phone: string | null
          settings: Json
          status: string
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          code: string
          company_id: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          manager_email?: string | null
          name: string
          phone?: string | null
          settings?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          city?: string | null
          code?: string
          company_id?: string
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          manager_email?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_memberships: {
        Row: {
          auth_user_id: string | null
          branch_id: string | null
          company_id: string
          created_at: string
          email: string
          erp_user_id: string | null
          id: string
          is_active: boolean
          is_branch_manager: boolean
          is_company_admin: boolean
          role: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          email: string
          erp_user_id?: string | null
          id?: string
          is_active?: boolean
          is_branch_manager?: boolean
          is_company_admin?: boolean
          role?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          email?: string
          erp_user_id?: string | null
          id?: string
          is_active?: boolean
          is_branch_manager?: boolean
          is_company_admin?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_memberships_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_memberships_erp_user_id_fkey"
            columns: ["erp_user_id"]
            isOneToOne: false
            referencedRelation: "erp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          activity_date: string
          activity_type: string
          created_at: string
          id: string
          notes: string | null
          related_id: string | null
          related_type: string | null
          subject: string
        }
        Insert: {
          activity_date?: string
          activity_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          related_id?: string | null
          related_type?: string | null
          subject: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          related_id?: string | null
          related_type?: string | null
          subject?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          branch_id: string | null
          company_id: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          lead_no: string
          notes: string | null
          phone: string | null
          priority: string
          source: string | null
          stakeholder_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_no: string
          notes?: string | null
          phone?: string | null
          priority?: string
          source?: string | null
          stakeholder_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          lead_no?: string
          notes?: string | null
          phone?: string | null
          priority?: string
          source?: string | null
          stakeholder_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          expected_close_date: string | null
          expected_value: number
          id: string
          lead_id: string | null
          notes: string | null
          opportunity_no: string
          probability: number
          stakeholder_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          expected_value?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_no: string
          probability?: number
          stakeholder_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          expected_value?: number
          id?: string
          lead_id?: string | null
          notes?: string | null
          opportunity_no?: string
          probability?: number
          stakeholder_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          priority: string
          related_id: string | null
          related_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          priority?: string
          related_id?: string | null
          related_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          document_type: string
          entity_id: string | null
          entity_type: string
          file_name: string
          file_path: string | null
          id: string
          notes: string | null
          uploaded_by: string | null
          version_no: number
        }
        Insert: {
          created_at?: string
          document_type: string
          entity_id?: string | null
          entity_type: string
          file_name: string
          file_path?: string | null
          id?: string
          notes?: string | null
          uploaded_by?: string | null
          version_no?: number
        }
        Update: {
          created_at?: string
          document_type?: string
          entity_id?: string | null
          entity_type?: string
          file_name?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          uploaded_by?: string | null
          version_no?: number
        }
        Relationships: []
      }
      employee_assets: {
        Row: {
          asset_code: string | null
          asset_name: string
          assigned_date: string
          created_at: string
          employee_id: string | null
          id: string
          notes: string | null
          returned_date: string | null
          status: string
        }
        Insert: {
          asset_code?: string | null
          asset_name: string
          assigned_date?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          returned_date?: string | null
          status?: string
        }
        Update: {
          asset_code?: string | null
          asset_name?: string
          assigned_date?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          returned_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_assets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_entries: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          notes: string | null
          overtime_hours: number
          regular_hours: number
          work_date: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          overtime_hours?: number
          regular_hours?: number
          work_date?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          overtime_hours?: number
          regular_hours?: number
          work_date?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_time_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          department: string | null
          department_id: string | null
          email: string | null
          employee_no: string | null
          erp_user_id: string | null
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          manager_employee_id: string | null
          notes: string | null
          phone: string | null
          position_id: string | null
          role: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          email?: string | null
          employee_no?: string | null
          erp_user_id?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          notes?: string | null
          phone?: string | null
          position_id?: string | null
          role?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          email?: string | null
          employee_no?: string | null
          erp_user_id?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          notes?: string | null
          phone?: string | null
          position_id?: string | null
          role?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_erp_user_id_fkey"
            columns: ["erp_user_id"]
            isOneToOne: false
            referencedRelation: "erp_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hr_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_notifications: {
        Row: {
          action_url: string | null
          body: string | null
          branch_id: string | null
          category: string
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          read_at: string | null
          recipient_email: string | null
          recipient_user_id: string | null
          severity: string
          title: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          branch_id?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_email?: string | null
          recipient_user_id?: string | null
          severity?: string
          title: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          branch_id?: string | null
          category?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          recipient_email?: string | null
          recipient_user_id?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "erp_users"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_number_sequences: {
        Row: {
          current_value: number
          id: string
          month: number | null
          prefix: string
          sequence_key: string
          updated_at: string
          year: number | null
        }
        Insert: {
          current_value?: number
          id?: string
          month?: number | null
          prefix: string
          sequence_key: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          current_value?: number
          id?: string
          month?: number | null
          prefix?: string
          sequence_key?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      erp_quotation_links: {
        Row: {
          created_at: string
          id: string
          quotation_id: string | null
          stakeholder_id: string | null
          status: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          quotation_id?: string | null
          stakeholder_id?: string | null
          status?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          quotation_id?: string | null
          stakeholder_id?: string | null
          status?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erp_quotation_links_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_users: {
        Row: {
          accessible_branch_ids: string[]
          accessible_company_ids: string[]
          auth_user_id: string | null
          created_at: string
          default_branch_id: string | null
          default_company_id: string | null
          department: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          permissions: string[]
          role: string
          roles: string[]
          updated_at: string
        }
        Insert: {
          accessible_branch_ids?: string[]
          accessible_company_ids?: string[]
          auth_user_id?: string | null
          created_at?: string
          default_branch_id?: string | null
          default_company_id?: string | null
          department?: string | null
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          permissions?: string[]
          role?: string
          roles?: string[]
          updated_at?: string
        }
        Update: {
          accessible_branch_ids?: string[]
          accessible_company_ids?: string[]
          auth_user_id?: string | null
          created_at?: string
          default_branch_id?: string | null
          default_company_id?: string | null
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          permissions?: string[]
          role?: string
          roles?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_users_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_users_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_type: string
          branch_id: string | null
          company_id: string | null
          created_at: string
          currency: string
          current_balance: number
          id: string
          is_active: boolean
          name: string
          opening_balance: number
        }
        Insert: {
          account_type: string
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name: string
          opening_balance?: number
        }
        Update: {
          account_type?: string
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          name?: string
          opening_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_departments: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          manager_employee_id: string | null
          name: string
          notes: string | null
          parent_department_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          name: string
          notes?: string | null
          parent_department_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          name?: string
          notes?: string | null
          parent_department_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_departments_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_requests: {
        Row: {
          approver_employee_id: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          notes: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approver_employee_id?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          leave_type?: string
          notes?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approver_employee_id?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          notes?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_requests_approver_employee_id_fkey"
            columns: ["approver_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_onboarding_tasks: {
        Row: {
          candidate_id: string | null
          created_at: string
          due_date: string | null
          employee_id: string | null
          id: string
          notes: string | null
          responsible_employee_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          due_date?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          responsible_employee_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          due_date?: string | null
          employee_id?: string | null
          id?: string
          notes?: string | null
          responsible_employee_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_onboarding_tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "hr_recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_onboarding_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_onboarding_tasks_responsible_employee_id_fkey"
            columns: ["responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_positions: {
        Row: {
          code: string | null
          created_at: string
          department_id: string | null
          id: string
          is_active: boolean
          notes: string | null
          reports_to_position_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          reports_to_position_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          reports_to_position_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_positions_reports_to_position_id_fkey"
            columns: ["reports_to_position_id"]
            isOneToOne: false
            referencedRelation: "hr_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_recruitment_candidates: {
        Row: {
          created_at: string
          department_id: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          position_id: string | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          position_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          position_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_recruitment_candidates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_recruitment_candidates_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hr_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          branch_id: string | null
          code: string | null
          company_id: string | null
          created_at: string
          current_stock: number
          default_warehouse_id: string | null
          description: string | null
          id: string
          is_active: boolean
          item_type: string
          location: string | null
          min_stock: number
          name: string
          supplier_id: string | null
          unit: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          current_stock?: number
          default_warehouse_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          item_type: string
          location?: string | null
          min_stock?: number
          name: string
          supplier_id?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string | null
          company_id?: string | null
          created_at?: string
          current_stock?: number
          default_warehouse_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          item_type?: string
          location?: string | null
          min_stock?: number
          name?: string
          supplier_id?: string | null
          unit?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_default_warehouse_id_fkey"
            columns: ["default_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          id: string
          inventory_item_id: string | null
          movement_date: string
          movement_type: string
          notes: string | null
          quantity: number
          source_id: string | null
          source_type: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          movement_date?: string
          movement_type: string
          notes?: string | null
          quantity: number
          source_id?: string | null
          source_type?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          movement_date?: string
          movement_type?: string
          notes?: string | null
          quantity?: number
          source_id?: string | null
          source_type?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          grand_total: number
          id: string
          invoice_date: string
          invoice_no: string | null
          invoice_type: string
          notes: string | null
          stakeholder_id: string | null
          status: string
          subtotal: number
          tax_total: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_no?: string | null
          invoice_type: string
          notes?: string | null
          stakeholder_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_no?: string | null
          invoice_type?: string
          notes?: string | null
          stakeholder_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          last_maintenance_date: string | null
          location: string | null
          machine_type: string | null
          maintenance_interval_days: number | null
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_maintenance_date?: string | null
          location?: string | null
          machine_type?: string | null
          maintenance_interval_days?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_maintenance_date?: string | null
          location?: string | null
          machine_type?: string | null
          maintenance_interval_days?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_tasks: {
        Row: {
          branch_id: string | null
          company_id: string | null
          completed_date: string | null
          created_at: string
          id: string
          machine_id: string | null
          notes: string | null
          planned_date: string | null
          responsible_employee_id: string | null
          status: string
          task_name: string
          task_type: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          completed_date?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          notes?: string | null
          planned_date?: string | null
          responsible_employee_id?: string | null
          status?: string
          task_name: string
          task_type?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          completed_date?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          notes?: string | null
          planned_date?: string | null
          responsible_employee_id?: string | null
          status?: string
          task_name?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_responsible_employee_id_fkey"
            columns: ["responsible_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      measuring_tools: {
        Row: {
          assigned_to: string | null
          calibration_due_date: string | null
          code: string | null
          created_at: string
          id: string
          last_calibration_date: string | null
          name: string
          notes: string | null
          serial_no: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          calibration_due_date?: string | null
          code?: string | null
          created_at?: string
          id?: string
          last_calibration_date?: string | null
          name: string
          notes?: string | null
          serial_no?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          calibration_due_date?: string | null
          code?: string | null
          created_at?: string
          id?: string
          last_calibration_date?: string | null
          name?: string
          notes?: string | null
          serial_no?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_counter: {
        Row: {
          counter: number
          id: number
          year: number
        }
        Insert: {
          counter?: number
          id?: number
          year: number
        }
        Update: {
          counter?: number
          id?: number
          year?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          reservation_status: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          reservation_status?: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          reservation_status?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          billing_address: string | null
          branch_id: string | null
          campaign_id: string | null
          carrier_name: string | null
          checkout_source: string
          company_id: string | null
          company_name: string | null
          created_at: string
          currency: string
          customer_name: string
          customer_reference: string | null
          customer_user_id: string | null
          email: string
          fulfillment_status: string
          grand_total: number
          id: string
          inventory_reservation_status: string
          invoice_id: string | null
          notes: string | null
          order_number: string
          paid_at: string | null
          payment_id: string | null
          payment_method: string
          payment_provider: string | null
          payment_reconciliation_status: string
          payment_status: string
          phone: string
          provider_payment_id: string | null
          provider_payment_url: string | null
          refund_status: string
          refunded_at: string | null
          sales_order_id: string | null
          shipping_address: string | null
          shipping_method: string | null
          shipping_status: string
          stakeholder_id: string | null
          status: string
          subtotal: number
          tax_total: number
          tracking_number: string | null
        }
        Insert: {
          address: string
          billing_address?: string | null
          branch_id?: string | null
          campaign_id?: string | null
          carrier_name?: string | null
          checkout_source?: string
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string
          customer_name: string
          customer_reference?: string | null
          customer_user_id?: string | null
          email: string
          fulfillment_status?: string
          grand_total: number
          id?: string
          inventory_reservation_status?: string
          invoice_id?: string | null
          notes?: string | null
          order_number: string
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string
          payment_provider?: string | null
          payment_reconciliation_status?: string
          payment_status?: string
          phone: string
          provider_payment_id?: string | null
          provider_payment_url?: string | null
          refund_status?: string
          refunded_at?: string | null
          sales_order_id?: string | null
          shipping_address?: string | null
          shipping_method?: string | null
          shipping_status?: string
          stakeholder_id?: string | null
          status?: string
          subtotal: number
          tax_total: number
          tracking_number?: string | null
        }
        Update: {
          address?: string
          billing_address?: string | null
          branch_id?: string | null
          campaign_id?: string | null
          carrier_name?: string | null
          checkout_source?: string
          company_id?: string | null
          company_name?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          customer_reference?: string | null
          customer_user_id?: string | null
          email?: string
          fulfillment_status?: string
          grand_total?: number
          id?: string
          inventory_reservation_status?: string
          invoice_id?: string | null
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string
          payment_provider?: string | null
          payment_reconciliation_status?: string
          payment_status?: string
          phone?: string
          provider_payment_id?: string | null
          provider_payment_url?: string | null
          refund_status?: string
          refunded_at?: string | null
          sales_order_id?: string | null
          shipping_address?: string | null
          shipping_method?: string | null
          shipping_status?: string
          stakeholder_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "shop_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_accounts: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          first_seen_at: string
          id: string
          included: Json
          last_seen_at: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships: Json
          resource_type: string
          source_archived: boolean | null
          source_created_at: string | null
          source_updated_at: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships?: Json
          resource_type: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id?: string
          parasut_id?: string
          payload_hash?: string
          raw_payload?: Json
          relationships?: Json
          resource_type?: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_contacts: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          first_seen_at: string
          id: string
          included: Json
          last_seen_at: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships: Json
          resource_type: string
          source_archived: boolean | null
          source_created_at: string | null
          source_updated_at: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships?: Json
          resource_type: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id?: string
          parasut_id?: string
          payload_hash?: string
          raw_payload?: Json
          relationships?: Json
          resource_type?: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_payments: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          first_seen_at: string
          id: string
          included: Json
          last_seen_at: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships: Json
          resource_type: string
          source_archived: boolean | null
          source_created_at: string | null
          source_updated_at: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships?: Json
          resource_type: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id?: string
          parasut_id?: string
          payload_hash?: string
          raw_payload?: Json
          relationships?: Json
          resource_type?: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_products: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          first_seen_at: string
          id: string
          included: Json
          last_seen_at: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships: Json
          resource_type: string
          source_archived: boolean | null
          source_created_at: string | null
          source_updated_at: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships?: Json
          resource_type: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id?: string
          parasut_id?: string
          payload_hash?: string
          raw_payload?: Json
          relationships?: Json
          resource_type?: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_purchase_bill_details: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          first_seen_at: string
          id: string
          included: Json
          last_seen_at: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships: Json
          resource_type: string
          source_archived: boolean | null
          source_created_at: string | null
          source_updated_at: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships?: Json
          resource_type: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id?: string
          parasut_id?: string
          payload_hash?: string
          raw_payload?: Json
          relationships?: Json
          resource_type?: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_purchase_bill_details_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_purchase_bills: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          first_seen_at: string
          id: string
          included: Json
          last_seen_at: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships: Json
          resource_type: string
          source_archived: boolean | null
          source_created_at: string | null
          source_updated_at: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships?: Json
          resource_type: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id?: string
          parasut_id?: string
          payload_hash?: string
          raw_payload?: Json
          relationships?: Json
          resource_type?: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_purchase_bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_sales_invoice_details: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          first_seen_at: string
          id: string
          included: Json
          last_seen_at: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships: Json
          resource_type: string
          source_archived: boolean | null
          source_created_at: string | null
          source_updated_at: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships?: Json
          resource_type: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id?: string
          parasut_id?: string
          payload_hash?: string
          raw_payload?: Json
          relationships?: Json
          resource_type?: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_sales_invoice_details_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_sales_invoices: {
        Row: {
          attributes: Json
          company_id: string
          created_at: string
          first_seen_at: string
          id: string
          included: Json
          last_seen_at: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships: Json
          resource_type: string
          source_archived: boolean | null
          source_created_at: string | null
          source_updated_at: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          company_id: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id: string
          parasut_id: string
          payload_hash: string
          raw_payload: Json
          relationships?: Json
          resource_type: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          company_id?: string
          created_at?: string
          first_seen_at?: string
          id?: string
          included?: Json
          last_seen_at?: string
          parasut_company_id?: string
          parasut_id?: string
          payload_hash?: string
          raw_payload?: Json
          relationships?: Json
          resource_type?: string
          source_archived?: boolean | null
          source_created_at?: string | null
          source_updated_at?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_sales_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_sync_errors: {
        Row: {
          company_id: string
          created_at: string
          error_code: string | null
          http_status: number | null
          id: string
          occurred_at: string
          parasut_company_id: string
          parasut_id: string | null
          resource_type: string
          retryable: boolean
          sanitized_message: string
          sync_run_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          error_code?: string | null
          http_status?: number | null
          id?: string
          occurred_at?: string
          parasut_company_id: string
          parasut_id?: string | null
          resource_type: string
          retryable?: boolean
          sanitized_message: string
          sync_run_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          error_code?: string | null
          http_status?: number | null
          id?: string
          occurred_at?: string
          parasut_company_id?: string
          parasut_id?: string | null
          resource_type?: string
          retryable?: boolean
          sanitized_message?: string
          sync_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_sync_errors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parasut_sync_errors_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "parasut_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      parasut_sync_runs: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          error_count: number
          id: string
          page_count: number
          parasut_company_id: string
          records_inserted: number
          records_observed: number
          records_unchanged: number
          records_updated: number
          request_metadata: Json
          resource_type: string
          started_at: string
          status: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_count?: number
          id?: string
          page_count?: number
          parasut_company_id: string
          records_inserted?: number
          records_observed?: number
          records_unchanged?: number
          records_updated?: number
          request_metadata?: Json
          resource_type: string
          started_at?: string
          status: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_count?: number
          id?: string
          page_count?: number
          parasut_company_id?: string
          records_inserted?: number
          records_observed?: number
          records_unchanged?: number
          records_updated?: number
          request_metadata?: Json
          resource_type?: string
          started_at?: string
          status?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parasut_sync_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_events: {
        Row: {
          branch_id: string | null
          company_id: string | null
          customer_user_id: string | null
          duplicate_detected: boolean
          error_message: string | null
          event_id: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          payload_hash: string
          payment_status_id: string | null
          processed_at: string | null
          processing_status: string
          provider: string
          received_at: string
          replay_detected: boolean
          signature_valid: boolean
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          customer_user_id?: string | null
          duplicate_detected?: boolean
          error_message?: string | null
          event_id: string
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json
          payload_hash: string
          payment_status_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider: string
          received_at?: string
          replay_detected?: boolean
          signature_valid?: boolean
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          customer_user_id?: string | null
          duplicate_detected?: boolean
          error_message?: string | null
          event_id?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          payload_hash?: string
          payment_status_id?: string | null
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_at?: string
          replay_detected?: boolean
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_provider_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_provider_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_provider_events_payment_status_id_fkey"
            columns: ["payment_status_id"]
            isOneToOne: false
            referencedRelation: "shop_payment_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_provider_health: {
        Row: {
          failure_count: number
          id: string
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          metadata: Json
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          failure_count?: number
          id?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          metadata?: Json
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          failure_count?: number
          id?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          metadata?: Json
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_reconciliation_logs: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          currency: string
          expected_amount: number
          id: string
          invoice_id: string | null
          metadata: Json
          notes: string | null
          order_id: string
          payment_id: string | null
          payment_status_id: string | null
          provider: string | null
          provider_payment_id: string | null
          received_amount: number
          status: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          expected_amount?: number
          id?: string
          invoice_id?: string | null
          metadata?: Json
          notes?: string | null
          order_id: string
          payment_id?: string | null
          payment_status_id?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          received_amount?: number
          status?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          expected_amount?: number
          id?: string
          invoice_id?: string | null
          metadata?: Json
          notes?: string | null
          order_id?: string
          payment_id?: string | null
          payment_status_id?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          received_amount?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reconciliation_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reconciliation_logs_payment_status_id_fkey"
            columns: ["payment_status_id"]
            isOneToOne: false
            referencedRelation: "shop_payment_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_refund_operations: {
        Row: {
          approved_amount: number | null
          branch_id: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          metadata: Json
          order_id: string
          payment_status_id: string | null
          provider: string | null
          provider_refund_id: string | null
          requested_amount: number
          return_request_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_amount?: number | null
          branch_id?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          metadata?: Json
          order_id: string
          payment_status_id?: string | null
          provider?: string | null
          provider_refund_id?: string | null
          requested_amount?: number
          return_request_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_amount?: number | null
          branch_id?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          payment_status_id?: string | null
          provider?: string | null
          provider_refund_id?: string | null
          requested_amount?: number
          return_request_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_refund_operations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refund_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refund_operations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refund_operations_payment_status_id_fkey"
            columns: ["payment_status_id"]
            isOneToOne: false
            referencedRelation: "shop_payment_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_refund_operations_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "shop_return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          branch_id: string | null
          company_id: string | null
          created_at: string
          currency: string
          description: string | null
          financial_account_id: string | null
          id: string
          payment_date: string
          payment_type: string
          related_invoice_id: string | null
          stakeholder_id: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          financial_account_id?: string | null
          id?: string
          payment_date?: string
          payment_type: string
          related_invoice_id?: string | null
          stakeholder_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          financial_account_id?: string | null
          id?: string
          payment_date?: string
          payment_type?: string
          related_invoice_id?: string | null
          stakeholder_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_key: string
          branch_id: string | null
          company_id: string
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          metadata: Json
          module: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_key: string
          branch_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          metadata?: Json
          module: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          source: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_key?: string
          branch_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          metadata?: Json
          module?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_alerts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "platform_events"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_events: {
        Row: {
          actor_email: string | null
          branch_id: string | null
          company_id: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          event_key: string
          event_type: string
          id: string
          metadata: Json
          module: string
          occurred_at: string
          severity: string
          source: string
          status: string
          title: string
        }
        Insert: {
          actor_email?: string | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_key: string
          event_type: string
          id?: string
          metadata?: Json
          module: string
          occurred_at?: string
          severity?: string
          source: string
          status?: string
          title: string
        }
        Update: {
          actor_email?: string | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_key?: string
          event_type?: string
          id?: string
          metadata?: Json
          module?: string
          occurred_at?: string
          severity?: string
          source?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_metrics: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          id: string
          measured_at: string
          metadata: Json
          metric_key: string
          metric_name: string
          metric_unit: string | null
          metric_value: number | null
          module: string
          severity: string
          source: string
          status: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          measured_at?: string
          metadata?: Json
          metric_key: string
          metric_name: string
          metric_unit?: string | null
          metric_value?: number | null
          module: string
          severity?: string
          source: string
          status?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          measured_at?: string
          metadata?: Json
          metric_key?: string
          metric_name?: string
          metric_unit?: string | null
          metric_value?: number | null
          module?: string
          severity?: string
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_metrics_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_primary: boolean | null
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean | null
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_route_steps: {
        Row: {
          created_at: string
          estimated_minutes: number
          id: string
          machine_id: string | null
          notes: string | null
          operation_name: string
          route_id: string | null
          step_no: number
        }
        Insert: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          machine_id?: string | null
          notes?: string | null
          operation_name: string
          route_id?: string | null
          step_no: number
        }
        Update: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          machine_id?: string | null
          notes?: string | null
          operation_name?: string
          route_id?: string | null
          step_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_route_steps_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_route_steps_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "production_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_routes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_template: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          branch_id: string | null
          brand: string | null
          category: string | null
          company_id: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          in_stock: boolean
          inventory_item_id: string | null
          is_shop_visible: boolean
          name: string
          price: number
          shop_category_id: string | null
          sku: string | null
          slug: string
          stock_quantity: number
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          in_stock?: boolean
          inventory_item_id?: string | null
          is_shop_visible?: boolean
          name: string
          price: number
          shop_category_id?: string | null
          sku?: string | null
          slug: string
          stock_quantity?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          brand?: string | null
          category?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          in_stock?: boolean
          inventory_item_id?: string | null
          is_shop_visible?: boolean
          name?: string
          price?: number
          shop_category_id?: string | null
          sku?: string | null
          slug?: string
          stock_quantity?: number
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_category_id_fkey"
            columns: ["shop_category_id"]
            isOneToOne: false
            referencedRelation: "shop_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          description: string
          id: string
          inventory_item_id: string | null
          purchase_order_id: string | null
          quantity: number | null
          received_quantity: number | null
          total: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          inventory_item_id?: string | null
          purchase_order_id?: string | null
          quantity?: number | null
          received_quantity?: number | null
          total?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          inventory_item_id?: string | null
          purchase_order_id?: string | null
          quantity?: number | null
          received_quantity?: number | null
          total?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string | null
          currency: string | null
          expected_delivery_date: string | null
          grand_total: number | null
          id: string
          notes: string | null
          order_date: string | null
          purchase_order_no: string
          status: string
          subtotal: number | null
          supplier_id: string | null
          tax_total: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          expected_delivery_date?: string | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          order_date?: string | null
          purchase_order_no: string
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          tax_total?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          expected_delivery_date?: string | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          order_date?: string | null
          purchase_order_no?: string
          status?: string
          subtotal?: number | null
          supplier_id?: string | null
          tax_total?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_measurements: {
        Row: {
          characteristic: string
          created_at: string
          id: string
          measured_value: string | null
          nominal_value: string | null
          quality_report_id: string | null
          result: string
          tolerance: string | null
        }
        Insert: {
          characteristic: string
          created_at?: string
          id?: string
          measured_value?: string | null
          nominal_value?: string | null
          quality_report_id?: string | null
          result?: string
          tolerance?: string | null
        }
        Update: {
          characteristic?: string
          created_at?: string
          id?: string
          measured_value?: string | null
          nominal_value?: string | null
          quality_report_id?: string | null
          result?: string
          tolerance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_measurements_quality_report_id_fkey"
            columns: ["quality_report_id"]
            isOneToOne: false
            referencedRelation: "quality_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_reports: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          id: string
          inspection_date: string
          inspector_employee_id: string | null
          notes: string | null
          report_no: string
          result: string
          sales_order_id: string | null
          updated_at: string
          work_order_id: string | null
          work_order_operation_id: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          inspection_date?: string
          inspector_employee_id?: string | null
          notes?: string | null
          report_no: string
          result?: string
          sales_order_id?: string | null
          updated_at?: string
          work_order_id?: string | null
          work_order_operation_id?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          inspection_date?: string
          inspector_employee_id?: string | null
          notes?: string | null
          report_no?: string
          result?: string
          sales_order_id?: string | null
          updated_at?: string
          work_order_id?: string | null
          work_order_operation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_reports_inspector_employee_id_fkey"
            columns: ["inspector_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_reports_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_reports_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_reports_work_order_operation_id_fkey"
            columns: ["work_order_operation_id"]
            isOneToOne: false
            referencedRelation: "work_order_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_code: string | null
          quantity: number
          sales_order_id: string | null
          technical_drawing_id: string | null
          total: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_code?: string | null
          quantity?: number
          sales_order_id?: string | null
          technical_drawing_id?: string | null
          total?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_code?: string | null
          quantity?: number
          sales_order_id?: string | null
          technical_drawing_id?: string | null
          total?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          grand_total: number
          id: string
          notes: string | null
          order_date: string
          order_no: string
          priority: string
          source_quotation_id: string | null
          stakeholder_id: string | null
          status: string
          subtotal: number
          tax_total: number
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_no: string
          priority?: string
          source_quotation_id?: string | null
          stakeholder_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          grand_total?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_no?: string
          priority?: string
          source_quotation_id?: string | null
          stakeholder_id?: string | null
          status?: string
          subtotal?: number
          tax_total?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_job_runs: {
        Row: {
          audit_log_id: string | null
          branch_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          failure_reason: string | null
          id: string
          job_key: string
          job_name: string
          job_type: string
          max_retries: number
          metadata: Json
          module: string
          next_retry_at: string | null
          parent_job_run_id: string | null
          queued_at: string | null
          retry_count: number
          severity: string
          source: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audit_log_id?: string | null
          branch_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          failure_reason?: string | null
          id?: string
          job_key: string
          job_name: string
          job_type: string
          max_retries?: number
          metadata?: Json
          module?: string
          next_retry_at?: string | null
          parent_job_run_id?: string | null
          queued_at?: string | null
          retry_count?: number
          severity?: string
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audit_log_id?: string | null
          branch_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          failure_reason?: string | null
          id?: string
          job_key?: string
          job_name?: string
          job_type?: string
          max_retries?: number
          metadata?: Json
          module?: string
          next_retry_at?: string | null
          parent_job_run_id?: string | null
          queued_at?: string | null
          retry_count?: number
          severity?: string
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_job_runs_audit_log_id_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "erp_audit_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_job_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_job_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_job_runs_parent_job_run_id_fkey"
            columns: ["parent_job_run_id"]
            isOneToOne: false
            referencedRelation: "scheduled_job_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          auth_enabled: boolean
          created_at: string
          id: number
          updated_at: string
        }
        Insert: {
          auth_enabled?: boolean
          created_at?: string
          id?: number
          updated_at?: string
        }
        Update: {
          auth_enabled?: boolean
          created_at?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      shipment_items: {
        Row: {
          created_at: string
          description: string
          id: string
          notes: string | null
          quantity: number
          shipment_id: string | null
          unit: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          quantity?: number
          shipment_id?: string | null
          unit?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          quantity?: number
          shipment_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          branch_id: string | null
          carrier: string | null
          company_id: string | null
          created_at: string
          delivery_note_no: string | null
          id: string
          notes: string | null
          package_count: number
          sales_order_id: string | null
          shipment_date: string
          shipment_no: string
          stakeholder_id: string | null
          status: string
          tracking_no: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          carrier?: string | null
          company_id?: string | null
          created_at?: string
          delivery_note_no?: string | null
          id?: string
          notes?: string | null
          package_count?: number
          sales_order_id?: string | null
          shipment_date?: string
          shipment_no: string
          stakeholder_id?: string | null
          status?: string
          tracking_no?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          carrier?: string | null
          company_id?: string | null
          created_at?: string
          delivery_note_no?: string | null
          id?: string
          notes?: string | null
          package_count?: number
          sales_order_id?: string | null
          shipment_date?: string
          shipment_no?: string
          stakeholder_id?: string | null
          status?: string
          tracking_no?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_campaigns: {
        Row: {
          code: string | null
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_carriers: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tracking_url_template: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tracking_url_template?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tracking_url_template?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shop_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          line_total: number
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          line_total?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "shop_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_carts: {
        Row: {
          converted_order_id: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_user_id: string | null
          guest_cart_key: string | null
          id: string
          notes: string | null
          status: string
          subtotal: number
          updated_at: string
        }
        Insert: {
          converted_order_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_user_id?: string | null
          guest_cart_key?: string | null
          id?: string
          notes?: string | null
          status?: string
          subtotal?: number
          updated_at?: string
        }
        Update: {
          converted_order_id?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_user_id?: string | null
          guest_cart_key?: string | null
          id?: string
          notes?: string | null
          status?: string
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_carts_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_category_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_category_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_category_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "shop_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_customer_notifications: {
        Row: {
          channel: string
          created_at: string
          customer_user_id: string | null
          event_type: string
          id: string
          message: string
          metadata: Json | null
          order_id: string | null
          read_at: string | null
          status: string
          title: string
        }
        Insert: {
          channel?: string
          created_at?: string
          customer_user_id?: string | null
          event_type: string
          id?: string
          message: string
          metadata?: Json | null
          order_id?: string | null
          read_at?: string | null
          status?: string
          title: string
        }
        Update: {
          channel?: string
          created_at?: string
          customer_user_id?: string | null
          event_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          order_id?: string | null
          read_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_customer_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_customer_profiles: {
        Row: {
          auth_user_id: string
          billing_address: string | null
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          shipping_address: string | null
          stakeholder_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          billing_address?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          shipping_address?: string | null
          stakeholder_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          billing_address?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          shipping_address?: string | null
          stakeholder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_customer_profiles_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_fulfillment_history: {
        Row: {
          created_at: string
          created_by: string | null
          customer_user_id: string | null
          description: string | null
          from_status: string | null
          id: string
          order_id: string
          to_status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_user_id?: string | null
          description?: string | null
          from_status?: string | null
          id?: string
          order_id: string
          to_status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_user_id?: string | null
          description?: string | null
          from_status?: string | null
          id?: string
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_fulfillment_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_inventory_reservations: {
        Row: {
          created_at: string
          id: string
          inventory_item_id: string | null
          order_id: string
          order_item_id: string | null
          product_id: string | null
          quantity: number
          reason: string | null
          released_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          order_id: string
          order_item_id?: string | null
          product_id?: string | null
          quantity: number
          reason?: string | null
          released_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_item_id?: string | null
          order_id?: string
          order_item_id?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string | null
          released_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_inventory_reservations_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_inventory_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_inventory_reservations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_inventory_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_payment_statuses: {
        Row: {
          amount: number
          branch_id: string | null
          company_id: string | null
          created_at: string
          currency: string
          customer_user_id: string | null
          future_provider: string | null
          id: string
          invoice_id: string | null
          lifecycle_status: string
          notes: string | null
          order_id: string
          payment_id: string | null
          provider: string | null
          provider_event_id: string | null
          provider_payload: Json
          reconciliation_status: string
          status: string
          transaction_reference: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_user_id?: string | null
          future_provider?: string | null
          id?: string
          invoice_id?: string | null
          lifecycle_status?: string
          notes?: string | null
          order_id: string
          payment_id?: string | null
          provider?: string | null
          provider_event_id?: string | null
          provider_payload?: Json
          reconciliation_status?: string
          status?: string
          transaction_reference?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_user_id?: string | null
          future_provider?: string | null
          id?: string
          invoice_id?: string | null
          lifecycle_status?: string
          notes?: string | null
          order_id?: string
          payment_id?: string | null
          provider?: string | null
          provider_event_id?: string | null
          provider_payload?: Json
          reconciliation_status?: string
          status?: string
          transaction_reference?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_payment_statuses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_payment_statuses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_payment_statuses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_payment_statuses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_payment_statuses_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_return_requests: {
        Row: {
          created_at: string
          customer_user_id: string
          id: string
          notes: string | null
          order_id: string
          reason: string
          refund_status: string
          requested_at: string
          reviewed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_user_id: string
          id?: string
          notes?: string | null
          order_id: string
          reason: string
          refund_status?: string
          requested_at?: string
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_user_id?: string
          id?: string
          notes?: string | null
          order_id?: string
          reason?: string
          refund_status?: string
          requested_at?: string
          reviewed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_shipments: {
        Row: {
          carrier_id: string | null
          carrier_name: string | null
          created_at: string
          customer_user_id: string | null
          delivered_at: string | null
          id: string
          notes: string | null
          order_id: string
          shipped_at: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier_id?: string | null
          carrier_name?: string | null
          created_at?: string
          customer_user_id?: string | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier_id?: string | null
          carrier_name?: string | null
          created_at?: string
          customer_user_id?: string | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_shipments_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shop_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_shipping_methods: {
        Row: {
          base_price: number
          code: string
          created_at: string
          currency: string
          description: string | null
          estimated_days: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          code: string
          created_at?: string
          currency?: string
          description?: string | null
          estimated_days?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          code?: string
          created_at?: string
          currency?: string
          description?: string | null
          estimated_days?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      stakeholders: {
        Row: {
          address: string | null
          branch_id: string | null
          city: string | null
          company_id: string | null
          company_name: string
          contact_name: string | null
          country: string
          created_at: string
          current_balance: number
          email: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          risk_limit: number
          tax_number: string | null
          tax_office: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          company_id?: string | null
          company_name: string
          contact_name?: string | null
          country?: string
          created_at?: string
          current_balance?: number
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          risk_limit?: number
          tax_number?: string | null
          tax_office?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string
          contact_name?: string | null
          country?: string
          created_at?: string
          current_balance?: number
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          risk_limit?: number
          tax_number?: string | null
          tax_office?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stakeholders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subcontracting_jobs: {
        Row: {
          created_at: string
          dispatch_no: string | null
          expected_return_date: string | null
          id: string
          notes: string | null
          process_type: string
          quantity_returned: number
          quantity_sent: number
          returned_date: string | null
          sent_date: string | null
          status: string
          supplier_id: string | null
          total_cost: number
          unit_cost: number
          updated_at: string
          work_order_id: string | null
          work_order_operation_id: string | null
        }
        Insert: {
          created_at?: string
          dispatch_no?: string | null
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          process_type: string
          quantity_returned?: number
          quantity_sent?: number
          returned_date?: string | null
          sent_date?: string | null
          status?: string
          supplier_id?: string | null
          total_cost?: number
          unit_cost?: number
          updated_at?: string
          work_order_id?: string | null
          work_order_operation_id?: string | null
        }
        Update: {
          created_at?: string
          dispatch_no?: string | null
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          process_type?: string
          quantity_returned?: number
          quantity_sent?: number
          returned_date?: string | null
          sent_date?: string | null
          status?: string
          supplier_id?: string | null
          total_cost?: number
          unit_cost?: number
          updated_at?: string
          work_order_id?: string | null
          work_order_operation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subcontracting_jobs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracting_jobs_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subcontracting_jobs_work_order_operation_id_fkey"
            columns: ["work_order_operation_id"]
            isOneToOne: false
            referencedRelation: "work_order_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line: string | null
          branch_id: string | null
          city: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          manager_email: string | null
          name: string
          status: string
          updated_at: string
          visibility_scope: string
        }
        Insert: {
          address_line?: string | null
          branch_id?: string | null
          city?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          manager_email?: string | null
          name: string
          status?: string
          updated_at?: string
          visibility_scope?: string
        }
        Update: {
          address_line?: string | null
          branch_id?: string | null
          city?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          manager_email?: string | null
          name?: string
          status?: string
          updated_at?: string
          visibility_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      website_banners: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          image_path: string | null
          link_url: string | null
          placement: string
          sort_order: number
          starts_at: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          image_path?: string | null
          link_url?: string | null
          placement?: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          image_path?: string | null
          link_url?: string | null
          placement?: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      website_form_submissions: {
        Row: {
          company_name: string | null
          created_at: string
          form_id: string | null
          id: string
          message: string | null
          sender_email: string | null
          sender_name: string | null
          sender_phone: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          form_id?: string | null
          id?: string
          message?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          form_id?: string | null
          id?: string
          message?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "website_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      website_forms: {
        Row: {
          created_at: string
          form_key: string
          id: string
          is_active: boolean
          name: string
          success_message: string | null
          target_email: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_key: string
          id?: string
          is_active?: boolean
          name: string
          success_message?: string | null
          target_email?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_key?: string
          id?: string
          is_active?: boolean
          name?: string
          success_message?: string | null
          target_email?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      website_media_assets: {
        Row: {
          alt_text: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          is_public: boolean
          media_type: string
          updated_at: string
          usage_area: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          is_public?: boolean
          media_type?: string
          updated_at?: string
          usage_area?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          is_public?: boolean
          media_type?: string
          updated_at?: string
          usage_area?: string | null
        }
        Relationships: []
      }
      website_menu_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          menu_area: string
          parent_item_id: string | null
          path: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          menu_area?: string
          parent_item_id?: string | null
          path: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          menu_area?: string
          parent_item_id?: string | null
          path?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_menu_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "website_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      website_pages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          locale: string
          page_type: string
          published_at: string | null
          slug: string
          status: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          locale?: string
          page_type?: string
          published_at?: string | null
          slug: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          locale?: string
          page_type?: string
          published_at?: string | null
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      website_seo_settings: {
        Row: {
          canonical_url: string | null
          created_at: string
          id: string
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          og_image_path: string | null
          page_id: string | null
          robots: string
          route_path: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_path?: string | null
          page_id?: string | null
          robots?: string
          route_path: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_path?: string | null
          page_id?: string | null
          robots?: string
          route_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_seo_settings_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "website_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_operations: {
        Row: {
          actual_minutes: number
          assigned_employee_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          machine_id: string | null
          notes: string | null
          operation_name: string
          planned_minutes: number
          quality_required: boolean
          started_at: string | null
          status: string
          step_no: number
          work_order_id: string | null
        }
        Insert: {
          actual_minutes?: number
          assigned_employee_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          notes?: string | null
          operation_name: string
          planned_minutes?: number
          quality_required?: boolean
          started_at?: string | null
          status?: string
          step_no: number
          work_order_id?: string | null
        }
        Update: {
          actual_minutes?: number
          assigned_employee_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          notes?: string | null
          operation_name?: string
          planned_minutes?: number
          quality_required?: boolean
          started_at?: string | null
          status?: string
          step_no?: number
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_order_operations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_operations_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_end_at: string | null
          actual_start_at: string | null
          branch_id: string | null
          company_id: string | null
          created_at: string
          id: string
          notes: string | null
          part_code: string | null
          part_name: string | null
          planned_end_date: string | null
          planned_start_date: string | null
          priority: string
          quantity: number
          sales_order_id: string | null
          stakeholder_id: string | null
          status: string
          title: string
          updated_at: string
          work_order_no: string
        }
        Insert: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          part_code?: string | null
          part_name?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string
          quantity?: number
          sales_order_id?: string | null
          stakeholder_id?: string | null
          status?: string
          title: string
          updated_at?: string
          work_order_no: string
        }
        Update: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          part_code?: string | null
          part_name?: string | null
          planned_end_date?: string | null
          planned_start_date?: string | null
          priority?: string
          quantity?: number
          sales_order_id?: string | null
          stakeholder_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          work_order_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "company_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_commerce_payment_financial_records: {
        Args: {
          p_amount: number
          p_currency: string
          p_order_id: string
          p_payment_status_id: string
          p_provider: string
          p_provider_payment_id: string
        }
        Returns: Json
      }
      erp_create_inventory_movement: {
        Args: {
          p_item_id: string
          p_movement_type: string
          p_notes?: string
          p_quantity: number
          p_source_id?: string
          p_source_type?: string
          p_warehouse_id?: string
        }
        Returns: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          id: string
          inventory_item_id: string | null
          movement_date: string
          movement_type: string
          notes: string | null
          quantity: number
          source_id: string | null
          source_type: string | null
          warehouse_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "inventory_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      erp_create_notification: {
        Args: {
          p_action_url?: string
          p_body?: string
          p_category: string
          p_entity_id?: string
          p_entity_type?: string
          p_recipient_email?: string
          p_recipient_user_id?: string
          p_severity: string
          p_title: string
        }
        Returns: string
      }
      erp_current_actor_email: { Args: never; Returns: string }
      erp_current_actor_id: { Args: never; Returns: string }
      erp_mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      erp_try_complete_work_order: {
        Args: { p_work_order_id: string }
        Returns: undefined
      }
      erp_write_audit_log: {
        Args: {
          p_action: string
          p_description?: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_new_status?: string
          p_old_status?: string
        }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
      is_email_allowed: { Args: { check_email: string }; Returns: boolean }
      next_erp_number: { Args: { p_sequence_key: string }; Returns: string }
      record_payment_reconciliation: {
        Args: {
          p_currency: string
          p_expected_amount: number
          p_metadata?: Json
          p_notes?: string
          p_order_id: string
          p_payment_status_id: string
          p_provider: string
          p_provider_payment_id: string
          p_received_amount: number
          p_status: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

