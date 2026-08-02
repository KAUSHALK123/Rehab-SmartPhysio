import os
import pytest
from fastapi.testclient import TestClient

# Set environment variable to redirect to test database BEFORE importing app modules
os.environ["DATABASE_URL"] = "sqlite:///./test_smartphysio.db"

from app.main import app
from app.database.database import Base, engine, get_db, SessionLocal
from app.models.user import User
from app.models.patient import Patient

@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    # Make sure we clean up any pre-existing test DB
    if os.path.exists("./test_smartphysio.db"):
        try:
            os.remove("./test_smartphysio.db")
        except Exception:
            pass
            
    # Tables are created and seeded when importing app.main
    yield
    
    # Session teardown: clean up the database file
    if os.path.exists("./test_smartphysio.db"):
        try:
            os.remove("./test_smartphysio.db")
        except Exception:
            pass

@pytest.fixture
def db():
    """Provides a transactional database session for each test case."""
    connection = engine.connect()
    transaction = connection.begin()
    db_session = SessionLocal(bind=connection)
    
    yield db_session
    
    db_session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db):
    """Provides a TestClient with overridden get_db dependency."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def test_user(db):
    """Creates a default test user."""
    from app.services.auth_service import get_password_hash
    
    user = db.query(User).filter(User.email == "test@example.com").first()
    if not user:
        user = User(
            email="test@example.com",
            password_hash=get_password_hash("testpassword")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@pytest.fixture
def auth_headers(test_user):
    """Provides authorization headers for the default test user."""
    from app.services.auth_service import create_access_token
    token = create_access_token(data={"sub": test_user.email})
    return {"Authorization": f"Bearer {token}"}
