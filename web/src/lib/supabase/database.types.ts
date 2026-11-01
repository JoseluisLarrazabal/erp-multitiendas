
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "dispositivos": {
                  Row: {
                    "created_at": string,"id": string,"negocio_id": string,"nombre": string,"prefijo": string,"ubicacion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"negocio_id": string,"nombre": string,"prefijo": string,"ubicacion_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string,"prefijo"?: string,"ubicacion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dispositivos_negocio_id_ubicacion_id_fkey"
      columns: ["negocio_id","ubicacion_id"]
isOneToOne: false
      referencedRelation: "ubicaciones"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"negocios": {
                  Row: {
                    "created_at": string,"datos_nota": string | null,"id": string,"nit": string | null,"nombre": string,"tipo": string,"tope_descuento": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"datos_nota"?: string | null,"id"?: string,"nit"?: string | null,"nombre": string,"tipo": string,"tope_descuento"?: number
                  }
                  Update: {
                    "created_at"?: string,"datos_nota"?: string | null,"id"?: string,"nit"?: string | null,"nombre"?: string,"tipo"?: string,"tope_descuento"?: number
                  }
                  Relationships: [
                    
                  ]
                },"perfiles": {
                  Row: {
                    "activo": boolean,"created_at": string,"id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"created_at"?: string,"id": string,"nombre": string
                  }
                  Update: {
                    "activo"?: boolean,"created_at"?: string,"id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rol_permisos": {
                  Row: {
                    "permiso": string,"rol": string,"tipo_negocio": string
                  }
                  ComputedFields: never
                  Insert: {
                    "permiso": string,"rol": string,"tipo_negocio": string
                  }
                  Update: {
                    "permiso"?: string,"rol"?: string,"tipo_negocio"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ubicaciones": {
                  Row: {
                    "created_at": string,"id": string,"negocio_id": string,"nombre": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"negocio_id": string,"nombre": string,"tipo": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ubicaciones_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"usuario_negocio": {
                  Row: {
                    "created_at": string,"negocio_id": string,"rol": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"negocio_id": string,"rol": string,"usuario_id": string
                  }
                  Update: {
                    "created_at"?: string,"negocio_id"?: string,"rol"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usuario_negocio_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "usuario_negocio_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "asignar_usuario":
{ Args: { "p_negocio_id": string,"p_rol": string,"p_usuario_id": string }; Returns: undefined
                           },
"comparte_negocio":
{ Args: { "p_usuario_id": string }; Returns: boolean
                           },
"es_dueno":
{ Args: { "p_negocio_id": string }; Returns: boolean
                           },
"mis_negocios":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"puede_administrar_cuenta":
{ Args: { "p_usuario_id": string }; Returns: boolean
                           },
"quitar_usuario":
{ Args: { "p_negocio_id": string,"p_usuario_id": string }; Returns: undefined
                           },
"registrar_dispositivo":
{ Args: { "p_negocio_id": string,"p_nombre": string,"p_prefijo": string,"p_ubicacion_id": string }; Returns: string
                           },
"tiene_permiso":
{ Args: { "p_negocio_id": string,"p_permiso": string }; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
