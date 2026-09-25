"""_approve_one delegates to the approve_generated_question() Postgres function
(migration 008); these tests pin how its outcomes map to the API contract."""
import types

import pytest

import api


class _PgError(Exception):
    """Shaped like postgrest's APIError, which exposes the RAISE text as .message."""
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def _rpc_raising(error):
    def rpc(name, params):
        assert name == "approve_generated_question"
        assert set(params) == {"p_id"}
        return types.SimpleNamespace(execute=lambda: (_ for _ in ()).throw(error))
    return rpc


def _rpc_ok(calls):
    def rpc(name, params):
        calls.append((name, params))
        return types.SimpleNamespace(execute=lambda: types.SimpleNamespace(data={"ok": True}))
    return rpc


def test_success(monkeypatch):
    calls = []
    monkeypatch.setattr(api, "supabase", types.SimpleNamespace(rpc=_rpc_ok(calls)))
    assert api._approve_one("q1") == (True, "approved")
    assert calls == [("approve_generated_question", {"p_id": "q1"})]


def test_unknown_id(monkeypatch):
    monkeypatch.setattr(api, "supabase", types.SimpleNamespace(
        rpc=_rpc_raising(_PgError("staged question q1 not found"))))
    assert api._approve_one("q1") == (False, "not found")


@pytest.mark.parametrize("status", ["approved", "rejected"])
def test_already_processed(monkeypatch, status):
    monkeypatch.setattr(api, "supabase", types.SimpleNamespace(
        rpc=_rpc_raising(_PgError(f"already {status}"))))
    assert api._approve_one("q1") == (False, f"already {status}")


def test_unexpected_database_error_is_not_swallowed(monkeypatch):
    monkeypatch.setattr(api, "supabase", types.SimpleNamespace(
        rpc=_rpc_raising(_PgError("connection reset"))))
    with pytest.raises(_PgError):
        api._approve_one("q1")


def test_batch_approve_reports_each_id(monkeypatch):
    """One failing id must not abort the rest of a bulk approve."""
    def rpc(name, params):
        if params["p_id"] == "bad":
            return types.SimpleNamespace(execute=lambda: (_ for _ in ()).throw(_PgError("already approved")))
        return types.SimpleNamespace(execute=lambda: types.SimpleNamespace(data={"ok": True}))
    monkeypatch.setattr(api, "supabase", types.SimpleNamespace(rpc=rpc))
    body = api.app.test_client().post(
        "/api/admin/questions/staging/batch-approve", json={"ids": ["a", "bad", "c"]}).get_json()
    assert body["approved"] == 2 and body["failed"] == 1
    assert body["results"]["bad"] == {"ok": False, "detail": "already approved"}
