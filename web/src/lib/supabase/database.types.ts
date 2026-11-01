
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
            "auditoria": {
                  Row: {
                    "accion": string,"antes": Json | null,"created_at": string,"despues": Json | null,"id": number,"negocio_id": string | null,"registro_id": string,"tabla": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accion": string,"antes"?: Json | null,"created_at"?: string,"despues"?: Json | null,"id"?: never,"negocio_id"?: string | null,"registro_id": string,"tabla": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "accion"?: string,"antes"?: Json | null,"created_at"?: string,"despues"?: Json | null,"id"?: never,"negocio_id"?: string | null,"registro_id"?: string,"tabla"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"categorias": {
                  Row: {
                    "created_at": string,"id": string,"negocio_id": string,"nombre": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"negocio_id": string,"nombre": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categorias_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"conteo_items": {
                  Row: {
                    "cantidad_contada": number,"cantidad_sistema": number,"conteo_id": string,"negocio_id": string,"producto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad_contada": number,"cantidad_sistema": number,"conteo_id": string,"negocio_id": string,"producto_id": string
                  }
                  Update: {
                    "cantidad_contada"?: number,"cantidad_sistema"?: number,"conteo_id"?: string,"negocio_id"?: string,"producto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conteo_items_negocio_id_conteo_id_fkey"
      columns: ["negocio_id","conteo_id"]
isOneToOne: false
      referencedRelation: "conteos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "conteo_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"conteos": {
                  Row: {
                    "fecha": string,"id": string,"motivo": string | null,"negocio_id": string,"ubicacion_id": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "fecha"?: string,"id": string,"motivo"?: string | null,"negocio_id": string,"ubicacion_id": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "fecha"?: string,"id"?: string,"motivo"?: string | null,"negocio_id"?: string,"ubicacion_id"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "conteos_negocio_id_ubicacion_id_fkey"
      columns: ["negocio_id","ubicacion_id"]
isOneToOne: false
      referencedRelation: "ubicaciones"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"dispositivos": {
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
                },"movimientos_inventario": {
                  Row: {
                    "cantidad": number,"costo_unitario": number | null,"created_at": string,"id": string,"motivo": string | null,"negocio_id": string,"producto_id": string,"ref_id": string | null,"ref_tipo": string | null,"tipo": string,"ubicacion_id": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"costo_unitario"?: number | null,"created_at"?: string,"id"?: string,"motivo"?: string | null,"negocio_id": string,"producto_id": string,"ref_id"?: string | null,"ref_tipo"?: string | null,"tipo": string,"ubicacion_id": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "cantidad"?: number,"costo_unitario"?: number | null,"created_at"?: string,"id"?: string,"motivo"?: string | null,"negocio_id"?: string,"producto_id"?: string,"ref_id"?: string | null,"ref_tipo"?: string | null,"tipo"?: string,"ubicacion_id"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "movimientos_inventario_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "movimientos_inventario_negocio_id_ubicacion_id_fkey"
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
                },"producto_precios": {
                  Row: {
                    "lista": string,"moneda": string,"monto": number,"negocio_id": string,"producto_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "lista": string,"moneda": string,"monto": number,"negocio_id": string,"producto_id": string,"updated_at"?: string
                  }
                  Update: {
                    "lista"?: string,"moneda"?: string,"monto"?: number,"negocio_id"?: string,"producto_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "producto_precios_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"productos": {
                  Row: {
                    "activo": boolean,"categoria_id": string | null,"codigo": string,"codigo_barras": string | null,"controla_serie": boolean,"created_at": string,"foto_path": string | null,"garantia_meses": number | null,"id": string,"marca": string | null,"modelo": string | null,"negocio_id": string,"nombre": string,"stock_minimo": number | null,"tipo": string,"unidad": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"categoria_id"?: string | null,"codigo": string,"codigo_barras"?: string | null,"controla_serie"?: boolean,"created_at"?: string,"foto_path"?: string | null,"garantia_meses"?: number | null,"id"?: string,"marca"?: string | null,"modelo"?: string | null,"negocio_id": string,"nombre": string,"stock_minimo"?: number | null,"tipo": string,"unidad"?: string,"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"categoria_id"?: string | null,"codigo"?: string,"codigo_barras"?: string | null,"controla_serie"?: boolean,"created_at"?: string,"foto_path"?: string | null,"garantia_meses"?: number | null,"id"?: string,"marca"?: string | null,"modelo"?: string | null,"negocio_id"?: string,"nombre"?: string,"stock_minimo"?: number | null,"tipo"?: string,"unidad"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "productos_negocio_id_categoria_id_fkey"
      columns: ["negocio_id","categoria_id"]
isOneToOne: false
      referencedRelation: "categorias"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "productos_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
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
                },"series": {
                  Row: {
                    "created_at": string,"estado": string,"id": string,"negocio_id": string,"producto_id": string,"serie": string,"ubicacion_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"estado"?: string,"id"?: string,"negocio_id": string,"producto_id": string,"serie": string,"ubicacion_id": string
                  }
                  Update: {
                    "created_at"?: string,"estado"?: string,"id"?: string,"negocio_id"?: string,"producto_id"?: string,"serie"?: string,"ubicacion_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "series_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "series_negocio_id_ubicacion_id_fkey"
      columns: ["negocio_id","ubicacion_id"]
isOneToOne: false
      referencedRelation: "ubicaciones"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"stock": {
                  Row: {
                    "cantidad": number,"costo_promedio": number | null,"negocio_id": string,"producto_id": string,"ubicacion_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad"?: number,"costo_promedio"?: number | null,"negocio_id": string,"producto_id": string,"ubicacion_id": string,"updated_at"?: string
                  }
                  Update: {
                    "cantidad"?: number,"costo_promedio"?: number | null,"negocio_id"?: string,"producto_id"?: string,"ubicacion_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "stock_negocio_id_ubicacion_id_fkey"
      columns: ["negocio_id","ubicacion_id"]
isOneToOne: false
      referencedRelation: "ubicaciones"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"tipos_cambio": {
                  Row: {
                    "id": string,"negocio_id": string,"usuario_id": string | null,"valor": number,"vigente_desde": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"negocio_id": string,"usuario_id"?: string | null,"valor": number,"vigente_desde"?: string
                  }
                  Update: {
                    "id"?: string,"negocio_id"?: string,"usuario_id"?: string | null,"valor"?: number,"vigente_desde"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tipos_cambio_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
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
            "producto_precios_bs": {
                  Row: {
                    "lista": string,"moneda": string,"monto": number,"monto_bs": number | null,"negocio_id": string,"producto_id": string,"tipo_cambio": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "producto_precios_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "ajustar_inventario":
{ Args: { "p_cantidad": number,"p_motivo": string,"p_negocio_id": string,"p_operacion_id": string,"p_producto_id": string,"p_serie_ids"?: (string)[],"p_tipo": string,"p_ubicacion_id": string }; Returns: string
                           },
"asignar_usuario":
{ Args: { "p_negocio_id": string,"p_rol": string,"p_usuario_id": string }; Returns: undefined
                           },
"auditar_cuenta":
{ Args: { "p_activo": boolean,"p_actor_id": string,"p_usuario_id": string }; Returns: undefined
                           },
"bloquear_series":
{ Args: { "p_cantidad": number,"p_ids": (string)[],"p_negocio_id": string,"p_producto_id": string,"p_ubicacion_id": string }; Returns: undefined
                           },
"comparte_negocio":
{ Args: { "p_usuario_id": string }; Returns: boolean
                           },
"costos_stock":
{ Args: { "p_negocio_id": string }; Returns: {
              "costo_promedio": number,"producto_id": string,"ubicacion_id": string
            }[]
                           },
"desactivar_producto":
{ Args: { "p_activo": boolean,"p_producto_id": string }; Returns: undefined
                           },
"es_dueno":
{ Args: { "p_negocio_id": string }; Returns: boolean
                           },
"fijar_costos":
{ Args: { "p_items": Json,"p_motivo": string,"p_negocio_id": string }; Returns: number
                           },
"guardar_categoria":
{ Args: { "p_id": string,"p_negocio_id": string,"p_nombre": string }; Returns: string
                           },
"guardar_precios":
{ Args: { "p_items": Json,"p_negocio_id": string }; Returns: number
                           },
"guardar_producto":
{ Args: { "p_datos": Json,"p_negocio_id": string }; Returns: string
                           },
"kardex_producto":
{ Args: { "p_desde_id"?: string,"p_limite"?: number,"p_producto_id": string,"p_ubicacion_id"?: string }; Returns: {
              "cantidad": number,"costo_unitario": number,"created_at": string,"id": string,"motivo": string,"ref_id": string,"ref_tipo": string,"tipo": string,"ubicacion_id": string,"usuario_id": string,"usuario_nombre": string
            }[]
                           },
"mis_negocios":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"precio_bs":
{ Args: { "p_lista": string,"p_producto_id": string }; Returns: number
                           },
"productos_stock_bajo":
{ Args: { "p_negocio_id": string }; Returns: {
              "cantidad": number,"codigo": string,"nombre": string,"producto_id": string,"stock_minimo": number
            }[]
                           },
"puede_administrar_cuenta":
{ Args: { "p_usuario_id": string }; Returns: boolean
                           },
"puede_asignar_rol":
{ Args: { "p_negocio_id": string,"p_rol": string }; Returns: boolean
                           },
"quitar_usuario":
{ Args: { "p_negocio_id": string,"p_usuario_id": string }; Returns: undefined
                           },
"registrar_conteo":
{ Args: { "p_items": Json,"p_motivo": string,"p_negocio_id": string,"p_operacion_id": string,"p_ubicacion_id": string }; Returns: number
                           },
"registrar_dispositivo":
{ Args: { "p_negocio_id": string,"p_nombre": string,"p_prefijo": string,"p_ubicacion_id": string }; Returns: string
                           },
"registrar_entrada":
{ Args: { "p_cantidad": number,"p_costo_unitario": number,"p_motivo": string,"p_negocio_id": string,"p_operacion_id": string,"p_producto_id": string,"p_ubicacion_id": string }; Returns: string
                           },
"registrar_series":
{ Args: { "p_negocio_id": string,"p_producto_id": string,"p_series": (string)[],"p_ubicacion_id": string }; Returns: number
                           },
"registrar_tipo_cambio":
{ Args: { "p_negocio_id": string,"p_valor": number }; Returns: string
                           },
"stock_inconsistente":
{ Args: { "p_negocio_id": string }; Returns: {
              "cantidad_kardex": number,"cantidad_stock": number,"producto_id": string,"ubicacion_id": string
            }[]
                           },
"tiene_permiso":
{ Args: { "p_negocio_id": string,"p_permiso": string }; Returns: boolean
                           },
"trasladar_stock":
{ Args: { "p_cantidad": number,"p_destino_id": string,"p_motivo": string,"p_negocio_id": string,"p_operacion_id": string,"p_origen_id": string,"p_producto_id": string,"p_serie_ids"?: (string)[] }; Returns: string
                           },
"validar_inventario":
{ Args: { "p_cantidad": number,"p_negocio_id": string,"p_producto_id": string,"p_ubicacion_id": string }; Returns: {
              "activo": boolean,
"categoria_id": string | null,
"codigo": string,
"codigo_barras": string | null,
"controla_serie": boolean,
"created_at": string,
"foto_path": string | null,
"garantia_meses": number | null,
"id": string,
"marca": string | null,
"modelo": string | null,
"negocio_id": string,
"nombre": string,
"stock_minimo": number | null,
"tipo": string,
"unidad": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "productos"
        isOneToOne: true
        isSetofReturn: false
      } }
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
