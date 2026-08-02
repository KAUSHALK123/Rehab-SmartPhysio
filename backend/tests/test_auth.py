import pytest
from fastapi import status
from app.config.config import settings

def test_register_user_success(client):
    response = client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={"email": "newuser@example.com", "password": "newpassword"}
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json() == {"message": "Registration successful"}

def test_register_user_already_exists(client, test_user):
    response = client.post(
        f"{settings.API_V1_STR}/auth/register",
        json={"email": "test@example.com", "password": "anotherpassword"}
    )
    assert response.status_code == status.HTTP_409_CONFLICT
    assert "already registered" in response.json()["detail"]

def test_login_user_success(client, test_user):
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": "test@example.com", "password": "testpassword"}
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "Bearer"

def test_login_user_wrong_password(client, test_user):
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": "test@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Incorrect email or password" in response.json()["detail"]

def test_login_user_not_found(client):
    response = client.post(
        f"{settings.API_V1_STR}/auth/login",
        json={"email": "nonexistent@example.com", "password": "somepassword"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Incorrect email or password" in response.json()["detail"]

def test_logout(client):
    response = client.post(f"{settings.API_V1_STR}/auth/logout")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"message": "Logged Out"}
