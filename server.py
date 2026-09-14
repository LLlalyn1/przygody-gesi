#!/usr/bin/env python3
"""Serwer lobby + relay dla 'Wielkie przygody gesi' (ko-op online 2 graczy).

Protokol (JSON, jeden obiekt na wiadomosc):
  -> {'t':'list'}                                   => {'t':'rooms','rooms':[{code,players,priv}]}
  -> {'t':'create','name':str,'priv':bool}          => {'t':'joined','code','you':1,'players':[..]}
  -> {'t':'join','code':str,'name':str}             => {'t':'joined',...} / {'t':'error','msg':..}
  -> {'t':'leave'}                                  => wychodzi z pokoju
  -> {'t':'ready','on':bool}                        => {'t':'readyState','ready':[names]}
  -> {'t':'playing','on':bool}                      => ukrywa pokoj z listy
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
import os as _os
REC_FILE = _os.environ.get("GAME_REC", "/opt/game/records.json")

rooms = {}   # code -> {'priv': bool, 'members': {ws: {'id': int, 'name': str}}}
ws_room = {}  # ws -> code


def load_wrec():
    try:
        with open(REC_FILE, "r", encoding="utf-8") as f:
            r = json.load(f)
            if isinstance(r.get("best"), dict) and isinstance(r.get("times"), list):
                return r
    except Exception:
        pass
    return {"best": {}, "times": []}


def save_wrec(r):
    try:
        tmp = REC_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(r, f, ensure_ascii=False)
        import os
        os.replace(tmp, REC_FILE)
    except Exception:
        pass


def wrec_top():
    r = load_wrec()
    best = sorted(r["best"].items(), key=lambda x: x[1], reverse=True)[:5]
    times = sorted(r["times"], key=lambda x: x["t"])[:5]
    return {"best": [{"n": n, "s": s} for n, s in best],
            "times": [{"n": x["n"], "t": x["t"]} for x in times]}


def public_rooms():
    return [{"code": c, "players": len(r["members"]), "max": MAX_PLAYERS}
            for c, r in rooms.items()
            if not r["priv"] and not r.get("playing") and len(r["members"]) < MAX_PLAYERS]


def names(room):
    return [m["name"] for m in room["members"].values()]


def ready_names(room):
    return [m["name"] for m in room["members"].values() if m.get("ready")]


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
    for m in room["members"].values():
        m["ready"] = False
    if not room["members"]:
        rooms.pop(code, None)
        return
    if notify:
        for m in list(room["members"]):
            await send(m, {"t": "players", "players": names(room)})
            await send(m, {"t": "readyState", "ready": ready_names(room)})
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

            elif t == "wrec":
                await send(ws, {"t": "wrec", **wrec_top()})

            elif t == "wsubmit":
                try:
                    name = str(msg.get("name", "Ges"))[:12] or "Ges"
                    s = int(msg.get("score", 0))
                    tt = float(msg.get("time", 0))
                    win = bool(msg.get("win"))
                    r = load_wrec()
                    if s > r["best"].get(name, 0):
                        r["best"][name] = s
                    if win and tt > 0:
                        r["times"].append({"n": name, "t": round(tt, 1)})
                        r["times"] = sorted(r["times"], key=lambda x: x["t"])[:10]
                    save_wrec(r)
                except Exception:
                    pass

            elif t == "create":
                await leave_room(ws)
                name = str(msg.get("name", "Ges"))[:16] or "Ges"
                code = gen_code()
                rooms[code] = {"priv": bool(msg.get("priv")), "members": {ws: {"id": 1, "name": name, "ready": False}}}
                ws_room[ws] = code
                await send(ws, {"t": "joined", "code": code, "you": 1,
                                "priv": rooms[code]["priv"], "players": [name]})
                await send(ws, {"t": "readyState", "ready": []})

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
                    base = str(msg.get("name", "Ges"))[:14] or "Ges"
                    name = base
                    k = 2
                    taken = {m["name"] for m in room["members"].values()}
                    while name in taken:
                        name = base + " " + str(k)
                        k += 1
                    room["members"][ws] = {"id": 2, "name": name, "ready": False}
                    ws_room[ws] = code
                    await send(ws, {"t": "joined", "code": code, "you": 2,
                                    "priv": room["priv"], "players": names(room)})
                    await send(ws, {"t": "readyState", "ready": ready_names(room)})
                    for m in room["members"]:
                        if m is not ws:
                            await send(m, {"t": "players", "players": names(room)})
                            await send(m, {"t": "readyState", "ready": ready_names(room)})
                            await send(m, {"t": "begin", "guest": name})

            elif t == "ready":
                code = ws_room.get(ws)
                room = rooms.get(code) if code else None
                if room and ws in room["members"]:
                    room["members"][ws]["ready"] = bool(msg.get("on"))
                    for m in room["members"]:
                        await send(m, {"t": "readyState", "ready": ready_names(room)})

            elif t == "leave":
                await leave_room(ws)

            elif t == "playing":
                code = ws_room.get(ws)
                room = rooms.get(code) if code else None
                if room:
                    room["playing"] = bool(msg.get("on"))

            elif t in ("state", "input", "over"):
                code = ws_room.get(ws)
                room = rooms.get(code) if code else None
                if room:
                    if t == "over":
                        for m in room["members"].values():
                            m["ready"] = False
                    for m in room["members"]:
                        if m is not ws:
                            await send(m, msg)
                    if t == "over":
                        for m in room["members"]:
                            await send(m, {"t": "readyState", "ready": ready_names(room)})
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
