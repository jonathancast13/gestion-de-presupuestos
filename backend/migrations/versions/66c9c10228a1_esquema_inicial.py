"""esquema inicial

Revisión base sin operaciones: el esquema inicial (clientes, documentos y
lineas_documento) lo crea ``db.create_all()`` al arrancar la aplicación, así
que esta revisión solo deja marcada la base de la cadena de migraciones.

Los cambios de esquema futuros se generan con ``flask db migrate`` y se
aplican con ``flask db upgrade``.

Revision ID: 66c9c10228a1
Revises: 
Create Date: 2026-10-29 23:52:50.501164

"""

# revision identifiers, used by Alembic.
revision = '66c9c10228a1'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
