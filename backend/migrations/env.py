from alembic import context
from sqlalchemy import URL, create_engine, pool

from app.core.database import Base
from app.core.settings import Settings

config = context.config
configured_url = config.attributes.get("database_url")
url = configured_url if isinstance(configured_url, URL) else Settings().database_url()

if context.is_offline_mode():
    context.configure(
        url=url,
        target_metadata=Base.metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    engine = create_engine(url, poolclass=pool.NullPool)
    try:
        with engine.connect() as connection:
            context.configure(connection=connection, target_metadata=Base.metadata)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()
