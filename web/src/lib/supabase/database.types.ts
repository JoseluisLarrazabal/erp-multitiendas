
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
                },"caja_movimientos": {
                  Row: {
                    "created_at": string,"enviada_por": string | null,"id": string,"monto": number,"motivo": string,"motivos_revision": (string)[],"negocio_id": string,"origen": string,"sesion_id": string,"tipo": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"enviada_por"?: string | null,"id": string,"monto": number,"motivo": string,"motivos_revision"?: (string)[],"negocio_id": string,"origen"?: string,"sesion_id": string,"tipo": string,"usuario_id": string
                  }
                  Update: {
                    "created_at"?: string,"enviada_por"?: string | null,"id"?: string,"monto"?: number,"motivo"?: string,"motivos_revision"?: (string)[],"negocio_id"?: string,"origen"?: string,"sesion_id"?: string,"tipo"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "caja_movimientos_enviada_por_fkey"
      columns: ["enviada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "caja_movimientos_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "caja_movimientos_negocio_id_sesion_id_fkey"
      columns: ["negocio_id","sesion_id"]
isOneToOne: false
      referencedRelation: "caja_sesiones"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "caja_movimientos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"caja_revisiones": {
                  Row: {
                    "id": string,"negocio_id": string,"ref_id": string,"revisado_en": string,"revisado_por": string,"tipo": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"negocio_id": string,"ref_id": string,"revisado_en"?: string,"revisado_por": string,"tipo": string
                  }
                  Update: {
                    "id"?: string,"negocio_id"?: string,"ref_id"?: string,"revisado_en"?: string,"revisado_por"?: string,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "caja_revisiones_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "caja_revisiones_revisado_por_fkey"
      columns: ["revisado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"caja_sesiones": {
                  Row: {
                    "abierta_en": string,"cerrada_en": string | null,"diferencia": number | null,"dispositivo_id": string,"enviada_por": string | null,"id": string,"monto_contado": number | null,"monto_esperado": number | null,"monto_inicial": number,"motivos_revision": (string)[],"negocio_id": string,"origen": string,"usuario_apertura": string,"usuario_cierre": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "abierta_en"?: string,"cerrada_en"?: string | null,"diferencia"?: number | null,"dispositivo_id": string,"enviada_por"?: string | null,"id": string,"monto_contado"?: number | null,"monto_esperado"?: number | null,"monto_inicial": number,"motivos_revision"?: (string)[],"negocio_id": string,"origen"?: string,"usuario_apertura": string,"usuario_cierre"?: string | null
                  }
                  Update: {
                    "abierta_en"?: string,"cerrada_en"?: string | null,"diferencia"?: number | null,"dispositivo_id"?: string,"enviada_por"?: string | null,"id"?: string,"monto_contado"?: number | null,"monto_esperado"?: number | null,"monto_inicial"?: number,"motivos_revision"?: (string)[],"negocio_id"?: string,"origen"?: string,"usuario_apertura"?: string,"usuario_cierre"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "caja_sesiones_enviada_por_fkey"
      columns: ["enviada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "caja_sesiones_negocio_id_dispositivo_id_fkey"
      columns: ["negocio_id","dispositivo_id"]
isOneToOne: false
      referencedRelation: "dispositivos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "caja_sesiones_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "caja_sesiones_usuario_apertura_fkey"
      columns: ["usuario_apertura"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "caja_sesiones_usuario_cierre_fkey"
      columns: ["usuario_cierre"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
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
                },"clientes": {
                  Row: {
                    "ci_nit": string | null,"created_at": string,"direccion": string | null,"id": string,"negocio_id": string,"nombre": string,"telefono": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ci_nit"?: string | null,"created_at"?: string,"direccion"?: string | null,"id"?: string,"negocio_id": string,"nombre": string,"telefono"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ci_nit"?: string | null,"created_at"?: string,"direccion"?: string | null,"id"?: string,"negocio_id"?: string,"nombre"?: string,"telefono"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"compra_items": {
                  Row: {
                    "cantidad": number,"compra_id": string,"costo_unitario": number,"negocio_id": string,"producto_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"compra_id": string,"costo_unitario": number,"negocio_id": string,"producto_id": string
                  }
                  Update: {
                    "cantidad"?: number,"compra_id"?: string,"costo_unitario"?: number,"negocio_id"?: string,"producto_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "compra_items_negocio_id_compra_id_fkey"
      columns: ["negocio_id","compra_id"]
isOneToOne: false
      referencedRelation: "compras"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "compra_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "compra_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "compra_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"compras": {
                  Row: {
                    "condicion": string,"created_at": string,"id": string,"negocio_id": string,"proveedor_id": string,"total": number,"ubicacion_id": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "condicion": string,"created_at"?: string,"id": string,"negocio_id": string,"proveedor_id": string,"total": number,"ubicacion_id": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "condicion"?: string,"created_at"?: string,"id"?: string,"negocio_id"?: string,"proveedor_id"?: string,"total"?: number,"ubicacion_id"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "compras_negocio_id_proveedor_id_fkey"
      columns: ["negocio_id","proveedor_id"]
isOneToOne: false
      referencedRelation: "proveedores"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "compras_negocio_id_ubicacion_id_fkey"
      columns: ["negocio_id","ubicacion_id"]
isOneToOne: false
      referencedRelation: "ubicaciones"
      referencedColumns: ["negocio_id","id"]
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
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "conteo_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "conteo_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
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
                },"devolucion_items": {
                  Row: {
                    "cantidad": number,"devolucion_id": string,"id": string,"monto": number,"negocio_id": string,"venta_item_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"devolucion_id": string,"id"?: string,"monto": number,"negocio_id": string,"venta_item_id": string
                  }
                  Update: {
                    "cantidad"?: number,"devolucion_id"?: string,"id"?: string,"monto"?: number,"negocio_id"?: string,"venta_item_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "devolucion_items_negocio_id_devolucion_id_fkey"
      columns: ["negocio_id","devolucion_id"]
isOneToOne: false
      referencedRelation: "devoluciones"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "devolucion_items_negocio_id_venta_item_id_fkey"
      columns: ["negocio_id","venta_item_id"]
isOneToOne: false
      referencedRelation: "venta_items"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"devoluciones": {
                  Row: {
                    "caja_sesion_id": string,"created_at": string,"dispositivo_id": string,"huella": string,"id": string,"monto": number,"monto_efectivo": number,"motivo": string,"negocio_id": string,"usuario_id": string,"venta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "caja_sesion_id": string,"created_at"?: string,"dispositivo_id": string,"huella": string,"id": string,"monto": number,"monto_efectivo": number,"motivo": string,"negocio_id": string,"usuario_id": string,"venta_id": string
                  }
                  Update: {
                    "caja_sesion_id"?: string,"created_at"?: string,"dispositivo_id"?: string,"huella"?: string,"id"?: string,"monto"?: number,"monto_efectivo"?: number,"motivo"?: string,"negocio_id"?: string,"usuario_id"?: string,"venta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "devoluciones_negocio_id_caja_sesion_id_fkey"
      columns: ["negocio_id","caja_sesion_id"]
isOneToOne: false
      referencedRelation: "caja_sesiones"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "devoluciones_negocio_id_dispositivo_id_fkey"
      columns: ["negocio_id","dispositivo_id"]
isOneToOne: false
      referencedRelation: "dispositivos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "devoluciones_negocio_id_venta_id_fkey"
      columns: ["negocio_id","venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "devoluciones_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dispositivos": {
                  Row: {
                    "created_at": string,"id": string,"negocio_id": string,"nombre": string,"prefijo": string,"ubicacion_id": string,"ultimo_numero": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"negocio_id": string,"nombre": string,"prefijo": string,"ubicacion_id": string,"ultimo_numero"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string,"prefijo"?: string,"ubicacion_id"?: string,"ultimo_numero"?: number
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
                },"lotes": {
                  Row: {
                    "cantidad": number,"codigo": string,"created_at": string,"id": string,"movimiento_id": string,"negocio_id": string,"producto_id": string,"ubicacion_id": string,"usuario_id": string | null,"vence": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"codigo": string,"created_at"?: string,"id"?: string,"movimiento_id": string,"negocio_id": string,"producto_id": string,"ubicacion_id": string,"usuario_id"?: string | null,"vence": string
                  }
                  Update: {
                    "cantidad"?: number,"codigo"?: string,"created_at"?: string,"id"?: string,"movimiento_id"?: string,"negocio_id"?: string,"producto_id"?: string,"ubicacion_id"?: string,"usuario_id"?: string | null,"vence"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lotes_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "lotes_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "lotes_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "lotes_negocio_id_ubicacion_id_fkey"
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
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "movimientos_inventario_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "movimientos_inventario_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
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
                },"operaciones_inventario": {
                  Row: {
                    "created_at": string,"huella": string,"id": string,"negocio_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"huella": string,"id": string,"negocio_id": string
                  }
                  Update: {
                    "created_at"?: string,"huella"?: string,"id"?: string,"negocio_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operaciones_inventario_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"orden_eventos": {
                  Row: {
                    "created_at": string,"estado": string,"id": string,"motivo": string | null,"negocio_id": string,"orden_id": string,"usuario_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"estado": string,"id"?: string,"motivo"?: string | null,"negocio_id": string,"orden_id": string,"usuario_id": string
                  }
                  Update: {
                    "created_at"?: string,"estado"?: string,"id"?: string,"motivo"?: string | null,"negocio_id"?: string,"orden_id"?: string,"usuario_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orden_eventos_negocio_id_orden_id_fkey"
      columns: ["negocio_id","orden_id"]
isOneToOne: false
      referencedRelation: "ordenes"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "orden_eventos_usuario_id_fkey"
      columns: ["usuario_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ordenes": {
                  Row: {
                    "anulada_por": string | null,"casillero": string | null,"cliente_nombre": string,"cliente_telefono": string | null,"documento_retiro": string | null,"entregada_en": string | null,"entregada_por": string | null,"estado": string,"estado_en": string,"express": boolean,"fecha_prometida": string,"huella": string,"id": string,"motivo_anulacion": string | null,"negocio_id": string,"nota": string | null,"prendas": number,"recibida_por": string,"retirada_por": string | null,"retiro_con": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anulada_por"?: string | null,"casillero"?: string | null,"cliente_nombre": string,"cliente_telefono"?: string | null,"documento_retiro"?: string | null,"entregada_en"?: string | null,"entregada_por"?: string | null,"estado"?: string,"estado_en"?: string,"express": boolean,"fecha_prometida": string,"huella": string,"id": string,"motivo_anulacion"?: string | null,"negocio_id": string,"nota"?: string | null,"prendas": number,"recibida_por": string,"retirada_por"?: string | null,"retiro_con"?: string | null
                  }
                  Update: {
                    "anulada_por"?: string | null,"casillero"?: string | null,"cliente_nombre"?: string,"cliente_telefono"?: string | null,"documento_retiro"?: string | null,"entregada_en"?: string | null,"entregada_por"?: string | null,"estado"?: string,"estado_en"?: string,"express"?: boolean,"fecha_prometida"?: string,"huella"?: string,"id"?: string,"motivo_anulacion"?: string | null,"negocio_id"?: string,"nota"?: string | null,"prendas"?: number,"recibida_por"?: string,"retirada_por"?: string | null,"retiro_con"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ordenes_anulada_por_fkey"
      columns: ["anulada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ordenes_entregada_por_fkey"
      columns: ["entregada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ordenes_negocio_id_id_fkey"
      columns: ["negocio_id","id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "ordenes_recibida_por_fkey"
      columns: ["recibida_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
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
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "producto_precios_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "producto_precios_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"productos": {
                  Row: {
                    "activo": boolean,"categoria_id": string | null,"codigo": string,"codigo_barras": string | null,"controla_serie": boolean,"created_at": string,"foto_path": string | null,"garantia_meses": number | null,"id": string,"marca": string | null,"modelo": string | null,"negocio_id": string,"nombre": string,"peso_paquete_kg": number | null,"stock_minimo": number | null,"tipo": string,"unidad": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"categoria_id"?: string | null,"codigo": string,"codigo_barras"?: string | null,"controla_serie"?: boolean,"created_at"?: string,"foto_path"?: string | null,"garantia_meses"?: number | null,"id"?: string,"marca"?: string | null,"modelo"?: string | null,"negocio_id": string,"nombre": string,"peso_paquete_kg"?: number | null,"stock_minimo"?: number | null,"tipo": string,"unidad"?: string,"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"categoria_id"?: string | null,"codigo"?: string,"codigo_barras"?: string | null,"controla_serie"?: boolean,"created_at"?: string,"foto_path"?: string | null,"garantia_meses"?: number | null,"id"?: string,"marca"?: string | null,"modelo"?: string | null,"negocio_id"?: string,"nombre"?: string,"peso_paquete_kg"?: number | null,"stock_minimo"?: number | null,"tipo"?: string,"unidad"?: string,"updated_at"?: string
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
                },"proveedor_pagos": {
                  Row: {
                    "compra_id": string | null,"created_at": string,"id": string,"medio": string,"monto": number,"negocio_id": string,"proveedor_id": string,"usuario_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "compra_id"?: string | null,"created_at"?: string,"id": string,"medio": string,"monto": number,"negocio_id": string,"proveedor_id": string,"usuario_id"?: string | null
                  }
                  Update: {
                    "compra_id"?: string | null,"created_at"?: string,"id"?: string,"medio"?: string,"monto"?: number,"negocio_id"?: string,"proveedor_id"?: string,"usuario_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "proveedor_pagos_negocio_id_compra_id_fkey"
      columns: ["negocio_id","compra_id"]
isOneToOne: false
      referencedRelation: "compras"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "proveedor_pagos_negocio_id_proveedor_id_fkey"
      columns: ["negocio_id","proveedor_id"]
isOneToOne: false
      referencedRelation: "proveedores"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"proveedores": {
                  Row: {
                    "activo": boolean,"contacto": string | null,"created_at": string,"id": string,"negocio_id": string,"nombre": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activo"?: boolean,"contacto"?: string | null,"created_at"?: string,"id"?: string,"negocio_id": string,"nombre": string,"updated_at"?: string
                  }
                  Update: {
                    "activo"?: boolean,"contacto"?: string | null,"created_at"?: string,"id"?: string,"negocio_id"?: string,"nombre"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "proveedores_negocio_id_fkey"
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
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "series_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "series_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
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
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "stock_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "stock_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
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
                },"venta_items": {
                  Row: {
                    "cantidad": number,"costo_unitario": number | null,"descuento": number,"descuento_venta": number,"id": string,"linea": number,"lista": string,"negocio_id": string,"precio_lista_servidor": number | null,"precio_unitario": number,"producto_id": string,"serie_id": string | null,"total_linea": number,"venta_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cantidad": number,"costo_unitario"?: number | null,"descuento"?: number,"descuento_venta"?: number,"id"?: string,"linea": number,"lista": string,"negocio_id": string,"precio_lista_servidor"?: number | null,"precio_unitario": number,"producto_id": string,"serie_id"?: string | null,"total_linea": number,"venta_id": string
                  }
                  Update: {
                    "cantidad"?: number,"costo_unitario"?: number | null,"descuento"?: number,"descuento_venta"?: number,"id"?: string,"linea"?: number,"lista"?: string,"negocio_id"?: string,"precio_lista_servidor"?: number | null,"precio_unitario"?: number,"producto_id"?: string,"serie_id"?: string | null,"total_linea"?: number,"venta_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venta_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "venta_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "venta_items_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "venta_items_negocio_id_venta_id_fkey"
      columns: ["negocio_id","venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "venta_items_serie_id_fkey"
      columns: ["serie_id"]
isOneToOne: false
      referencedRelation: "series"
      referencedColumns: ["id"]
    }
                  ]
                },"venta_pagos": {
                  Row: {
                    "id": string,"medio": string,"monto": number,"negocio_id": string,"venta_id": string,"verificacion": string,"verificado_en": string | null,"verificado_por": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"medio": string,"monto": number,"negocio_id": string,"venta_id": string,"verificacion": string,"verificado_en"?: string | null,"verificado_por"?: string | null
                  }
                  Update: {
                    "id"?: string,"medio"?: string,"monto"?: number,"negocio_id"?: string,"venta_id"?: string,"verificacion"?: string,"verificado_en"?: string | null,"verificado_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "venta_pagos_negocio_id_venta_id_fkey"
      columns: ["negocio_id","venta_id"]
isOneToOne: false
      referencedRelation: "ventas"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "venta_pagos_verificado_por_fkey"
      columns: ["verificado_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ventas": {
                  Row: {
                    "anulada_en": string | null,"anulada_por": string | null,"caja_sesion_id": string,"cliente_id": string | null,"condicion": string,"creada_en_cliente": string,"descuento": number,"dispositivo_id": string,"enviada_por": string,"estado": string,"huella": string,"id": string,"motivo_anulacion": string | null,"motivos_revision": (string)[],"negocio_id": string,"numero": string,"origen": string,"recibida_en": string,"revisada_en": string | null,"revisada_por": string | null,"subtotal": number,"tipo_cambio": number | null,"total": number,"ubicacion_id": string,"vendedor_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anulada_en"?: string | null,"anulada_por"?: string | null,"caja_sesion_id": string,"cliente_id"?: string | null,"condicion"?: string,"creada_en_cliente": string,"descuento"?: number,"dispositivo_id": string,"enviada_por": string,"estado"?: string,"huella": string,"id": string,"motivo_anulacion"?: string | null,"motivos_revision"?: (string)[],"negocio_id": string,"numero": string,"origen": string,"recibida_en"?: string,"revisada_en"?: string | null,"revisada_por"?: string | null,"subtotal": number,"tipo_cambio"?: number | null,"total": number,"ubicacion_id": string,"vendedor_id": string
                  }
                  Update: {
                    "anulada_en"?: string | null,"anulada_por"?: string | null,"caja_sesion_id"?: string,"cliente_id"?: string | null,"condicion"?: string,"creada_en_cliente"?: string,"descuento"?: number,"dispositivo_id"?: string,"enviada_por"?: string,"estado"?: string,"huella"?: string,"id"?: string,"motivo_anulacion"?: string | null,"motivos_revision"?: (string)[],"negocio_id"?: string,"numero"?: string,"origen"?: string,"recibida_en"?: string,"revisada_en"?: string | null,"revisada_por"?: string | null,"subtotal"?: number,"tipo_cambio"?: number | null,"total"?: number,"ubicacion_id"?: string,"vendedor_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ventas_anulada_por_fkey"
      columns: ["anulada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ventas_enviada_por_fkey"
      columns: ["enviada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ventas_negocio_id_caja_sesion_id_fkey"
      columns: ["negocio_id","caja_sesion_id"]
isOneToOne: false
      referencedRelation: "caja_sesiones"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "ventas_negocio_id_cliente_id_fkey"
      columns: ["negocio_id","cliente_id"]
isOneToOne: false
      referencedRelation: "clientes"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "ventas_negocio_id_dispositivo_id_fkey"
      columns: ["negocio_id","dispositivo_id"]
isOneToOne: false
      referencedRelation: "dispositivos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "ventas_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ventas_negocio_id_ubicacion_id_fkey"
      columns: ["negocio_id","ubicacion_id"]
isOneToOne: false
      referencedRelation: "ubicaciones"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "ventas_revisada_por_fkey"
      columns: ["revisada_por"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ventas_vendedor_id_fkey"
      columns: ["vendedor_id"]
isOneToOne: false
      referencedRelation: "perfiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "inventario_lista": {
                  Row: {
                    "activo": boolean,"codigo": string,"codigo_barras": string | null,"controla_serie": boolean,"id": string,"marca": string | null,"negocio_id": string,"nombre": string,"stock_bajo": boolean | null,"stock_minimo": number | null,"stock_negativo": boolean | null,"stock_total": number | null,"unidad": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "productos_negocio_id_fkey"
      columns: ["negocio_id"]
isOneToOne: false
      referencedRelation: "negocios"
      referencedColumns: ["id"]
    }
                  ]
                },"producto_precios_bs": {
                  Row: {
                    "lista": string,"moneda": string,"monto": number,"monto_bs": number | null,"negocio_id": string,"producto_id": string,"tipo_cambio": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "producto_precios_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "inventario_lista"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "producto_precios_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos"
      referencedColumns: ["negocio_id","id"]
    },{
      foreignKeyName: "producto_precios_negocio_id_producto_id_fkey"
      columns: ["negocio_id","producto_id"]
isOneToOne: false
      referencedRelation: "productos_lista"
      referencedColumns: ["negocio_id","id"]
    }
                  ]
                },"productos_lista": {
                  Row: {
                    "activo": boolean,"categoria_id": string | null,"categoria_nombre": string | null,"codigo": string,"codigo_barras": string | null,"con_precio": boolean | null,"foto_path": string | null,"id": string,"marca": string | null,"modelo": string | null,"moneda_principal": string | null,"monto_principal": number | null,"negocio_id": string,"nombre": string,"peso_paquete_kg": number | null,"principal_bs": number | null,"tipo": string,"unidad": string
                  }
                  ComputedFields: never
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
                }
          }
          Functions: {
            "abrir_caja":
{ Args: { "p_dispositivo_id": string,"p_id": string,"p_monto_inicial": number,"p_negocio_id": string,"p_offline"?: Json }; Returns: string
                           },
"ajustar_inventario":
{ Args: { "p_cantidad": number,"p_motivo": string,"p_negocio_id": string,"p_operacion_id": string,"p_producto_id": string,"p_serie_ids"?: (string)[],"p_tipo": string,"p_ubicacion_id": string }; Returns: string
                           },
"anular_orden":
{ Args: { "p_motivo": string,"p_orden_id": string }; Returns: Json
                           },
"anular_venta":
{ Args: { "p_motivo": string,"p_venta_id": string }; Returns: Json
                           },
"asignar_foto_producto":
{ Args: { "p_foto_path": string,"p_producto_id": string }; Returns: undefined
                           },
"asignar_fotos_importacion":
{ Args: { "p_items": Json,"p_negocio_id": string }; Returns: Json
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
"bloquear_stock":
{ Args: { "p_negocio_id": string,"p_producto_ids": (string)[],"p_ubicacion_id": string }; Returns: undefined
                           },
"caja_sesion_abierta":
{ Args: { "p_dispositivo_id": string }; Returns: {
              "abierta_en": string,
"cerrada_en": string | null,
"diferencia": number | null,
"dispositivo_id": string,
"enviada_por": string | null,
"id": string,
"monto_contado": number | null,
"monto_esperado": number | null,
"monto_inicial": number,
"motivos_revision": (string)[],
"negocio_id": string,
"origen": string,
"usuario_apertura": string,
"usuario_cierre": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "caja_sesiones"
        isOneToOne: false
        isSetofReturn: true
      } },
"cambiar_estado_orden":
{ Args: { "p_estado": string,"p_orden_id": string }; Returns: Json
                           },
"catalogo_pos":
{ Args: { "p_ubicacion_id": string }; Returns: Json
                           },
"cerrar_caja":
{ Args: { "p_monto_contado": number,"p_sesion_id": string }; Returns: Json
                           },
"comparte_negocio":
{ Args: { "p_usuario_id": string }; Returns: boolean
                           },
"costos_stock":
{ Args: { "p_negocio_id": string,"p_producto_ids": (string)[] }; Returns: {
              "costo_promedio": number,"producto_id": string,"ubicacion_id": string
            }[]
                           },
"crear_orden":
{ Args: { "p_offline"?: Json,"p_orden": Json,"p_venta": Json }; Returns: Json
                           },
"desactivar_producto":
{ Args: { "p_activo": boolean,"p_producto_id": string }; Returns: undefined
                           },
"deuda_proveedor":
{ Args: { "p_proveedor_id": string }; Returns: number
                           },
"deudas_proveedores":
{ Args: { "p_negocio_id": string }; Returns: {
              "deuda": number,"proveedor_id": string,"total_compras": number,"total_pagos": number
            }[]
                           },
"devolver_venta":
{ Args: { "p_devolucion": Json }; Returns: Json
                           },
"efectivo_esperado":
{ Args: { "p_sesion_id": string }; Returns: number
                           },
"entregar_orden":
{ Args: { "p_documento"?: string,"p_orden_id": string,"p_retirada_por": string,"p_retiro_con": string }; Returns: Json
                           },
"es_dueno":
{ Args: { "p_negocio_id": string }; Returns: boolean
                           },
"fijar_costos":
{ Args: { "p_items": Json,"p_motivo": string,"p_negocio_id": string }; Returns: number
                           },
"fijar_tope_descuento":
{ Args: { "p_negocio_id": string,"p_tope": number }; Returns: number
                           },
"guardar_categoria":
{ Args: { "p_id": string,"p_negocio_id": string,"p_nombre": string }; Returns: string
                           },
"guardar_cliente":
{ Args: { "p_datos": Json,"p_negocio_id": string }; Returns: string
                           },
"guardar_precios":
{ Args: { "p_items": Json,"p_negocio_id": string }; Returns: number
                           },
"guardar_producto":
{ Args: { "p_datos": Json,"p_negocio_id": string }; Returns: string
                           },
"guardar_proveedor":
{ Args: { "p_datos": Json,"p_negocio_id": string }; Returns: string
                           },
"kardex_producto":
{ Args: { "p_desde_id"?: string,"p_limite"?: number,"p_producto_id": string,"p_ubicacion_id"?: string }; Returns: {
              "cantidad": number,"costo_unitario": number,"created_at": string,"id": string,"motivo": string,"ref_id": string,"ref_tipo": string,"tipo": string,"ubicacion_id": string,"usuario_id": string,"usuario_nombre": string
            }[]
                           },
"lotes_por_vencer":
{ Args: { "p_dias"?: number,"p_negocio_id": string }; Returns: Json
                           },
"mis_negocios":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"negocio_de_ruta_foto":
{ Args: { "p_ruta": string }; Returns: string
                           },
"offline_caja":
{ Args: { "p_offline": Json }; Returns: {
              "hora": string,"usuario_id": string
            }[]
                           },
"pagar_proveedor":
{ Args: { "p_pago": Json }; Returns: string
                           },
"payload_claves":
{ Args: { "p": Json,"p_claves": (string)[] }; Returns: undefined
                           },
"payload_numero":
{ Args: { "p": Json,"p_clave": string,"p_dec": number,"p_defecto"?: number }; Returns: number
                           },
"payload_texto":
{ Args: { "p": Json,"p_clave": string,"p_max": number }; Returns: string
                           },
"payload_timestamp":
{ Args: { "p": Json,"p_clave": string }; Returns: string
                           },
"payload_uuid":
{ Args: { "p": Json,"p_clave": string,"p_nulo": boolean }; Returns: string
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
"reclamar_operacion":
{ Args: { "p_huella": string,"p_id": string,"p_negocio_id": string }; Returns: boolean
                           },
"reconciliacion_caja":
{ Args: { "p_limite"?: number,"p_negocio_id": string }; Returns: {
              "detalle": string,"enviada_por": string,"enviada_por_nombre": string,"hora": string,"id": string,"monto": number,"motivos": (string)[],"sesion_id": string,"tipo": string,"usuario_id": string,"usuario_nombre": string
            }[]
                           },
"reconciliacion_ventas":
{ Args: { "p_desde_id"?: string,"p_limite"?: number,"p_negocio_id": string }; Returns: {
              "creada_en_cliente": string,"enviada_por": string,"enviada_por_nombre": string,"id": string,"motivos_revision": (string)[],"numero": string,"pagos_pendientes": Json,"recibida_en": string,"total": number,"vendedor_id": string,"vendedor_nombre": string
            }[]
                           },
"registrar_compra":
{ Args: { "p_compra": Json }; Returns: Json
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
"registrar_entrada_lote":
{ Args: { "p_cantidad": number,"p_costo_unitario": number,"p_lote": string,"p_motivo": string,"p_negocio_id": string,"p_operacion_id": string,"p_producto_id": string,"p_ubicacion_id": string,"p_vence": string }; Returns: string
                           },
"registrar_movimiento_caja":
{ Args: { "p_id": string,"p_monto": number,"p_motivo": string,"p_offline"?: Json,"p_sesion_id": string,"p_tipo": string }; Returns: string
                           },
"registrar_series":
{ Args: { "p_negocio_id": string,"p_producto_id": string,"p_series": (string)[],"p_ubicacion_id": string }; Returns: number
                           },
"registrar_stock_inicial":
{ Args: { "p_items": Json,"p_negocio_id": string }; Returns: Json
                           },
"registrar_tipo_cambio":
{ Args: { "p_negocio_id": string,"p_valor": number }; Returns: string
                           },
"registrar_venta":
{ Args: { "p_offline"?: Json,"p_venta": Json }; Returns: Json
                           },
"reporte_caja":
{ Args: { "p_desde": string,"p_hasta": string,"p_negocio_id": string }; Returns: Json
                           },
"reporte_stock":
{ Args: { "p_dias_sin_movimiento"?: number,"p_negocio_id": string }; Returns: Json
                           },
"reporte_ventas":
{ Args: { "p_agrupar": string,"p_desde": string,"p_hasta": string,"p_negocio_id": string }; Returns: Json
                           },
"resolver_devolucion_existente":
{ Args: { "p_dev": Omit<Database["public"]['Tables']["devoluciones"]['Row'], Database["public"]['Tables']["devoluciones"]['ComputedFields']>,"p_huella": string,"p_negocio_id": string }; Returns: Json
                           },
"resolver_venta_existente":
{ Args: { "p_huella": string,"p_negocio_id": string,"p_venta": Omit<Database["public"]['Tables']["ventas"]['Row'], Database["public"]['Tables']["ventas"]['ComputedFields']> }; Returns: Json
                           },
"resumen_caja":
{ Args: { "p_sesion_id": string }; Returns: Json
                           },
"revisar_caja":
{ Args: { "p_id": string,"p_tipo": string }; Returns: Json
                           },
"revisar_venta":
{ Args: { "p_venta_id": string }; Returns: Json
                           },
"stock_inconsistente":
{ Args: { "p_negocio_id": string }; Returns: {
              "cantidad_kardex": number,"cantidad_stock": number,"producto_id": string,"ubicacion_id": string
            }[]
                           },
"tiene_permiso":
{ Args: { "p_negocio_id": string,"p_permiso": string }; Returns: boolean
                           },
"tiene_permiso_de":
{ Args: { "p_negocio_id": string,"p_permiso": string,"p_usuario_id": string }; Returns: boolean
                           },
"total_qr_sesion":
{ Args: { "p_sesion_id": string }; Returns: number
                           },
"totales_compras":
{ Args: { "p_compra_ids": (string)[],"p_negocio_id": string }; Returns: {
              "compra_id": string,"total": number
            }[]
                           },
"trasladar_stock":
{ Args: { "p_cantidad": number,"p_destino_id": string,"p_motivo": string,"p_negocio_id": string,"p_operacion_id": string,"p_origen_id": string,"p_producto_id": string,"p_serie_ids"?: (string)[] }; Returns: string
                           },
"usuario_en_negocio":
{ Args: { "p_negocio_id": string,"p_usuario_id": string }; Returns: boolean
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
"peso_paquete_kg": number | null,
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
      } },
"validar_offline_caja":
{ Args: { "p_hora": string,"p_negocio_id": string,"p_usuario": string }; Returns: {
              "hora_ajustada": string,"marcas": (string)[]
            }[]
                           },
"verificar_pago_qr":
{ Args: { "p_cobrado"?: boolean,"p_pago_id": string }; Returns: Json
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
