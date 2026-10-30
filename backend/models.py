from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Cliente(db.Model):
    __tablename__ = 'clientes'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    nif = db.Column(db.String(20), nullable=True)
    telefono = db.Column(db.String(20), nullable=True)
    direccion = db.Column(db.String(255), nullable=True)
    
    # Relación con documentos
    documentos = db.relationship('Documento', backref='cliente', lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "nif": self.nif,
            "telefono": self.telefono,
            "direccion": self.direccion
        }


class Documento(db.Model):
    __tablename__ = 'documentos'
    
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False)  # 'presupuesto' o 'factura'
    numero = db.Column(db.String(50), unique=True, nullable=False) # ej: PRE-2026-001
    fecha = db.Column(db.String(20), nullable=False)
    
    # Clave foránea para el cliente
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False)
    
    # Totales
    subtotal = db.Column(db.Float, nullable=False)
    total_iva = db.Column(db.Float, nullable=False)
    total_general = db.Column(db.Float, nullable=False)

    # Descripción breve del trabajo (opcional, la escribe el cliente)
    descripcion_trabajo = db.Column(db.Text, nullable=True)
    
    # Relación con las líneas (partidas), siempre en el orden en que se crearon
    lineas = db.relationship(
        'LineaDocumento',
        backref='documento',
        cascade="all, delete-orphan",
        lazy=True,
        order_by='LineaDocumento.id',
    )

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "numero": self.numero,
            "fecha": self.fecha,
            "cliente": self.cliente.to_dict() if self.cliente else None,
            "descripcion_trabajo": self.descripcion_trabajo,
            "subtotal": self.subtotal,
            "total_iva": self.total_iva,
            "total_general": self.total_general,
            "lineas": [linea.to_dict() for linea in self.lineas]
        }


class LineaDocumento(db.Model):
    __tablename__ = 'lineas_documento'
    
    id = db.Column(db.Integer, primary_key=True)
    documento_id = db.Column(db.Integer, db.ForeignKey('documentos.id'), nullable=False)
    descripcion = db.Column(db.String(255), nullable=False)
    cantidad = db.Column(db.Float, nullable=False)
    precio_unitario = db.Column(db.Float, nullable=False)
    iva = db.Column(db.Float, nullable=False) # Ej: 21.0 o 10.0

    def to_dict(self):
        return {
            "id": self.id,
            "descripcion": self.descripcion,
            "cantidad": self.cantidad,
            "precio_unitario": self.precio_unitario,
            "iva": self.iva,
            "subtotal": self.cantidad * self.precio_unitario
        }