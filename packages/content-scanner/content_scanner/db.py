"""Database wrapper."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator, Sequence, TypeVar

import psycopg
from psycopg.rows import dict_row

from content_scanner.config import DbConfig

T = TypeVar("T")


class Db:
    def __init__(self, cfg: DbConfig) -> None:
        self.cfg = cfg
        self._conn: psycopg.Connection[dict[str, Any]] | None = None

    def connect(self) -> None:
        self._conn = psycopg.connect(self.cfg.dsn, row_factory=dict_row)
        self._conn.autocommit = False

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    def __enter__(self) -> Db:
        self.connect()
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    @contextmanager
    def tx(self) -> Iterator[psycopg.Cursor[dict[str, Any]]]:
        if not self._conn:
            raise RuntimeError("DB not connected")
        with self._conn.cursor() as cur:
            try:
                yield cur
                self._conn.commit()
            except Exception:
                self._conn.rollback()
                raise

    def fetch_one(
        self, sql: str, params: Sequence[Any] | dict[str, Any] = ()
    ) -> dict[str, Any] | None:
        with self.tx() as cur:
            cur.execute(sql, params)
            return cur.fetchone()

    def fetch_all(
        self, sql: str, params: Sequence[Any] | dict[str, Any] = ()
    ) -> list[dict[str, Any]]:
        with self.tx() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())

    def execute(self, sql: str, params: Sequence[Any] | dict[str, Any] = ()) -> None:
        with self.tx() as cur:
            cur.execute(sql, params)

    def executemany(self, sql: str, params_seq: Sequence[Sequence[Any]]) -> None:
        with self.tx() as cur:
            cur.executemany(sql, params_seq)

    def execute_script(self, sql: str) -> None:
        if not self._conn:
            raise RuntimeError("DB not connected")
        with self._conn.cursor() as cur:
            cur.execute(sql)
            self._conn.commit()

    def fetch_typed_all(
        self,
        model: type[T],
        sql: str,
        params: Sequence[Any] | dict[str, Any] = (),
    ) -> list[T]:
        rows = self.fetch_all(sql, params)
        return [model(**r) for r in rows]  # type: ignore[misc]
