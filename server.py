#!/usr/bin/env python3
"""Serwer lobby + relay dla 'Wielkie przygody gesi' (ko-op online 2 graczy).

Protokol (JSON, jeden obiekt na wiadomosc):
  -> {'t':'list'}                                   => {'t':'rooms','rooms':[{code,players,priv}]}
  -> {'t':'create','name':str,'priv':bool}          => {'t':'joined','code','you':1,'players':[..]}
  -> {'t':'join','code':str,'name':str}             => {'t':'joined',...} / {'t':'error','msg':..}
  -> {'t':'leave'}                                  => wychodzi z pokoju
  host-> {'t':'state', ...snapshot...}              => relay do goscia
  gosc-> {'t':'input', ...}                         => relay do hosta
  serwis-> {'t':'players','players':[..]} / {'t':'left'} / {'t':'begin','you':2}

Uruchomienie: /opt/game/venv/bin/python /opt/game/server.py  (systemd: game)
Nasluchuje tylko na 127.0.0.1:8001, na zewnatrz przez nginx /ws/ (443).
"""

import asyncio
import json
import random
import string

HOST = "127.0.0.1"
PORT = 8001
MAX_PLAYERS = 2

rooms = {}   # code -> {'priv': bool, 'members': {ws: {'id': int, 'name': str}}}
ws_room = {}  # ws -> code


def public_rooms():
    return [{"code": c, "players": len(r["members"]), "max": MAX_PLAYERS}
            for c, r in rooms.items()
            if not r["priv"] and not r.get("playing") and len(r["members"]) < MAX_PLAYERS]


def names(room):
    return [m["name"] for m in room["members"].values()]


def gen_code():
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    for _ in range(50):
        code = "".join(random.choice(alphabet) for _ in range(5))
        if code not in rooms:
            return code
    raise RuntimeError("brak wolnych kodow")


async def send(ws, obj):
    try:
        await ws.send(json.dumps(obj))
    except Exception:
        pass


async def leave_room(ws, notify=True):
    code = ws_room.pop(ws, None)
    if not code:
        return
    room = rooms.get(code)
    if not room:
        return
    room["members"].pop(ws, None)
    room["playing"] = False
    if not room["members"]:
        rooms.pop(code, None)
        return
    if notify:
        for m in list(room["members"]):
            await send(m, {"t": "players", "players": names(room)})
            await send(m, {"t": "left"})


async def handle(ws):
    try:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            t = msg.get("t")

            if t == "list":
                await send(ws, {"t": "rooms", "rooms": public_rooms()})

            elif t == "create":
                await leave_room(ws)
                name = str(msg.get("name", "Ges"))[:16] or "Ges"
                code = gen_code()
                rooms[code] = {"priv": bool(msg.get("priv")), "members": {ws: {"id": 1, "name": name}}}
                ws_room[ws] = code
                await send(ws, {"t": "joined", "code": code, "you": 1,
                                "priv": rooms[code]["priv"], "players": [name]})

            elif t == "join":
                await leave_room(ws)
                code = str(msg.get("code", "")).upper().strip()
                name = str(msg.get("name", "Ges"))[:16] or "Ges"
                room = rooms.get(code)
                if not room:
                    await send(ws, {"t": "error", "msg": "Brak pokoju " + code})
                elif len(room["members"]) >= MAX_PLAYERS:
                    await send(ws, {"t": "error", "msg": "Pokoj pelny"})
                else:
                    room["members"][ws] = {"id": 2, "name": name}
                    ws_room[ws] = code
                    await send(ws, {"t": "joined", "code": code, "you": 2,
                                    "priv": room["priv"], "players": names(room)})
                    for m in room["members"]:
                        if m is not ws:
                            await send(m, {"t": "players", "players": names(room)})
                            await send(m, {"t": "begin", "guest": name})

            elif t == "leave":
                await leave_room(ws)

            elif t == "playing":
                code = ws_room.get(ws)
                room = rooms.get(code) if code else None
                if room:
                    room["playing"] = bool(msg.get("on"))

            elif t in ("state", "input"):
                code = ws_room.get(ws)
                room = rooms.get(code) if code else None
                if room:
                    for m in room["members"]:
                        if m is not ws:
                            await send(m, msg)
    finally:
        await leave_room(ws)


async def main():
    import websockets
    async with websockets.serve(handle, HOST, PORT, ping_interval=20, ping_timeout=20,
                                max_size=1_000_000):
        print("game-server na %s:%d" % (HOST, PORT), flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    import websockets  # noqa: F401  (twardy wymog)
    asyncio.run(main())
