""" Tests for the Stock Agent API """

from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_health_endpoint():
    """ Test the healthcheck endpoint """
    response = client.get("/healthcheck")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
