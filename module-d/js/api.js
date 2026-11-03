/*
  API client. With APP_CONFIG.apiUrl set it talks to the real Module C API.
  Without it, a built-in demo API answers the same paths with the same
  status codes and bodies, using the Module C dump and localStorage.
*/
(function () {
  'use strict';

  var config = window.APP_CONFIG || {};
  var base = (config.apiUrl || '').replace(/\/+$/, '');

  function http(method, path, body) {
    return fetch(base + path, {
      method: method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 204) {
        return { status: 204, data: null };
      }
      return res.json().then(
        function (data) { return { status: res.status, data: data }; },
        function () { return { status: res.status, data: null }; }
      );
    });
  }

  /* ---------- Demo API ---------- */

  var KEY = 'esc-demo-api-v1';
  var D = window.ESC_DATA;
  var data = null;

  function index() {
    if (data) {
      return data;
    }
    data = { locations: {}, concerts: {}, shows: {}, rows: {}, rowsByShow: {} };
    D.locations.forEach(function (l) { data.locations[l[0]] = { id: l[0], name: l[1] }; });
    D.concerts.forEach(function (c) { data.concerts[c[0]] = { id: c[0], artist: c[1], location_id: c[2], shows: [] }; });
    D.shows.forEach(function (s) {
      var show = { id: s[0], start: s[1], end: s[2], concert_id: s[3] };
      data.shows[s[0]] = show;
      data.concerts[s[3]].shows.push(show);
    });
    D.rows.forEach(function (r) {
      var row = { id: r[0], name: r[1], total: r[2], show_id: r[3] };
      data.rows[r[0]] = row;
      (data.rowsByShow[r[3]] = data.rowsByShow[r[3]] || []).push(row);
    });
    return data;
  }

  function load() {
    var s;
    try {
      s = JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      s = null;
    }
    return s || { seq: 1, reservations: [], bookings: [], tickets: [] };
  }

  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      /* storage full or blocked: the demo keeps working for this page view */
    }
  }

  function iso(dbDate) {
    return dbDate.replace(' ', 'T') + 'Z';
  }

  function isoMs(ms) {
    return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  /* About one seat in seven is already sold in the demo, always the same ones. */
  function presold(rowId, seat) {
    var h = Math.imul(rowId, 2654435761) ^ Math.imul(seat + 7, 2246822519);
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507);
    h ^= h >>> 13;
    return (h >>> 0) % 100 < 14;
  }

  function purge(s) {
    var now = Date.now();
    s.reservations = s.reservations.filter(function (r) { return r.until > now; });
  }

  function taken(s, rowId, seat, exceptToken) {
    if (presold(rowId, seat)) {
      return true;
    }
    if (s.tickets.some(function (t) { return t.row_id === rowId && t.seat === seat; })) {
      return true;
    }
    return s.reservations.some(function (r) {
      return r.token !== exceptToken && r.seats.some(function (x) { return x.row_id === rowId && x.seat === seat; });
    });
  }

  function locationOf(c) {
    var l = data.locations[c.location_id];
    return { id: l.id, name: l.name };
  }

  function showJson(sh) {
    return { id: sh.id, start: iso(sh.start), end: iso(sh.end) };
  }

  function concertJson(c) {
    return {
      id: c.id,
      artist: c.artist,
      location: locationOf(c),
      shows: c.shows.slice().sort(function (a, b) { return a.start < b.start ? -1 : 1; }).map(showJson)
    };
  }

  function ticketJson(s, t) {
    var booking = s.bookings.filter(function (b) { return b.id === t.booking_id; })[0];
    var row = data.rows[t.row_id];
    var sh = data.shows[row.show_id];
    var c = data.concerts[sh.concert_id];
    var show = showJson(sh);
    show.concert = { id: c.id, artist: c.artist, location: locationOf(c) };
    return {
      id: t.id, code: t.code, name: booking.name, created_at: booking.created_at,
      row: { id: row.id, name: row.name }, seat: t.seat, show: show
    };
  }

  function bookingTickets(s, bookingId) {
    return s.tickets
      .filter(function (t) { return t.booking_id === bookingId; })
      .sort(function (a, b) { return a.row_id - b.row_id || a.seat - b.seat; })
      .map(function (t) { return ticketJson(s, t); });
  }

  function randomToken() {
    var a = new Uint8Array(24);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function randomCode(s) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var code;
    do {
      var a = new Uint8Array(10);
      crypto.getRandomValues(a);
      code = Array.prototype.map.call(a, function (b) { return chars[b % 36]; }).join('');
    } while (s.tickets.some(function (t) { return t.code === code; }));
    return code;
  }

  function label(field) {
    return field.replace(/_/g, ' ');
  }

  var NOT_FOUND = { error: 'A concert or show with this ID does not exist' };

  function findShow(cid, sid) {
    var c = data.concerts[cid];
    var sh = data.shows[sid];
    return c && sh && sh.concert_id === c.id ? sh : null;
  }

  function demo(method, path, body) {
    index();
    body = body || {};
    var s = load();
    purge(s);
    var m;

    if (method === 'GET' && path === '/concerts') {
      var list = Object.keys(data.concerts).map(function (k) { return data.concerts[k]; })
        .sort(function (a, b) { return a.artist.localeCompare(b.artist, 'en'); });
      return { status: 200, data: { concerts: list.map(concertJson) } };
    }

    if (method === 'GET' && (m = path.match(/^\/concerts\/(\d+)$/))) {
      var concert = data.concerts[m[1]];
      return concert
        ? { status: 200, data: { concert: concertJson(concert) } }
        : { status: 404, data: { error: 'A concert with this ID does not exist' } };
    }

    if (method === 'GET' && (m = path.match(/^\/concerts\/(\d+)\/shows\/(\d+)\/seating$/))) {
      var show = findShow(+m[1], +m[2]);
      if (!show) {
        return { status: 404, data: NOT_FOUND };
      }
      var rows = (data.rowsByShow[show.id] || []).map(function (r) {
        var unavailable = [];
        for (var n = 1; n <= r.total; n++) {
          if (taken(s, r.id, n, null)) {
            unavailable.push(n);
          }
        }
        return { id: r.id, name: r.name, seats: { total: r.total, unavailable: unavailable } };
      });
      return { status: 200, data: { rows: rows } };
    }

    if (method === 'POST' && (m = path.match(/^\/concerts\/(\d+)\/shows\/(\d+)\/reservation$/))) {
      var rshow = findShow(+m[1], +m[2]);
      if (!rshow) {
        return { status: 404, data: NOT_FOUND };
      }
      var token = body.reservation_token;
      var existing = null;
      if (token !== undefined && token !== null && token !== '') {
        existing = s.reservations.filter(function (r) { return r.token === token; })[0];
        if (!existing) {
          return { status: 403, data: { error: 'Invalid reservation token' } };
        }
      }
      var fields = {};
      var seats = body.reservations;
      if (!Array.isArray(seats)) {
        fields.reservations = 'The reservations field is required.';
      } else {
        for (var i = 0; i < seats.length && !fields.reservations; i++) {
          var it = seats[i] || {};
          if (it.row === undefined || it.row === null) {
            fields.reservations = 'The row field is required.';
          } else if (it.seat === undefined || it.seat === null) {
            fields.reservations = 'The seat field is required.';
          }
        }
        for (var j = 0; j < seats.length && !fields.reservations; j++) {
          var row = data.rows[seats[j].row];
          if (!row || row.show_id !== rshow.id || seats[j].seat < 1 || seats[j].seat > row.total || seats[j].seat % 1) {
            fields.reservations = 'Seat ' + seats[j].seat + ' in row ' + seats[j].row + ' is invalid.';
          }
        }
        for (var k = 0; k < seats.length && !fields.reservations; k++) {
          if (taken(s, seats[k].row, seats[k].seat, token || null)) {
            fields.reservations = 'Seat ' + seats[k].seat + ' in row ' + seats[k].row + ' is already taken.';
          }
        }
      }
      var duration = body.duration === undefined ? 300 : body.duration;
      if (typeof duration !== 'number' || duration % 1 || duration < 1 || duration > 300) {
        fields.duration = 'The duration must be between 1 and 300.';
      }
      if (Object.keys(fields).length) {
        return { status: 422, data: { error: 'Validation failed', fields: fields } };
      }
      if (!existing) {
        existing = { id: s.seq++, token: randomToken(), until: 0, seats: [] };
        s.reservations.push(existing);
      }
      existing.seats = existing.seats.filter(function (x) { return data.rows[x.row_id].show_id !== rshow.id; });
      seats.forEach(function (x) {
        existing.seats.push({ id: s.seq++, row_id: x.row, seat: x.seat });
      });
      existing.until = Date.now() + duration * 1000;
      save(s);
      return { status: 201, data: { reserved: true, reservation_token: existing.token, reserved_until: isoMs(existing.until) } };
    }

    if (method === 'POST' && (m = path.match(/^\/concerts\/(\d+)\/shows\/(\d+)\/booking$/))) {
      var bshow = findShow(+m[1], +m[2]);
      if (!bshow) {
        return { status: 404, data: NOT_FOUND };
      }
      var errors = {};
      ['reservation_token', 'name', 'address', 'city', 'zip', 'country'].forEach(function (f) {
        if (body[f] === undefined || body[f] === null || body[f] === '') {
          errors[f] = 'The ' + label(f) + ' field is required.';
        } else if (typeof body[f] !== 'string') {
          errors[f] = 'The ' + label(f) + ' must be a string.';
        }
      });
      if (Object.keys(errors).length) {
        return { status: 422, data: { error: 'Validation failed', fields: errors } };
      }
      var res = s.reservations.filter(function (r) { return r.token === body.reservation_token; })[0];
      var mine = res ? res.seats.filter(function (x) { return data.rows[x.row_id].show_id === bshow.id; }) : [];
      if (!res || !mine.length) {
        return { status: 401, data: { error: 'Unauthorized' } };
      }
      var booking = {
        id: s.seq++, name: body.name, address: body.address, city: body.city, zip: body.zip,
        country: body.country, created_at: isoMs(Date.now())
      };
      s.bookings.push(booking);
      mine.forEach(function (x) {
        s.tickets.push({ id: x.id, code: randomCode(s), booking_id: booking.id, row_id: x.row_id, seat: x.seat });
      });
      res.seats = res.seats.filter(function (x) { return mine.indexOf(x) === -1; });
      if (!res.seats.length) {
        s.reservations.splice(s.reservations.indexOf(res), 1);
      }
      save(s);
      return { status: 201, data: { tickets: bookingTickets(s, booking.id) } };
    }

    if (method === 'POST' && path === '/tickets') {
      var hit = typeof body.code === 'string' && typeof body.name === 'string' && s.tickets.filter(function (t) {
        var b = s.bookings.filter(function (x) { return x.id === t.booking_id; })[0];
        return t.code === body.code && b && b.name === body.name;
      })[0];
      return hit
        ? { status: 200, data: { tickets: bookingTickets(s, hit.booking_id) } }
        : { status: 401, data: { error: 'Unauthorized' } };
    }

    if (method === 'POST' && (m = path.match(/^\/tickets\/(\d+)\/cancel$/))) {
      var ticket = s.tickets.filter(function (t) { return t.id === +m[1]; })[0];
      if (!ticket) {
        return { status: 404, data: { error: 'A ticket with this ID does not exist' } };
      }
      var owner = s.bookings.filter(function (b) { return b.id === ticket.booking_id; })[0];
      if (typeof body.code !== 'string' || typeof body.name !== 'string' || ticket.code !== body.code || owner.name !== body.name) {
        return { status: 401, data: { error: 'Unauthorized' } };
      }
      s.tickets.splice(s.tickets.indexOf(ticket), 1);
      save(s);
      return { status: 204, data: null };
    }

    return { status: 404, data: { error: 'Not found' } };
  }

  function request(method, path, body) {
    if (base) {
      return http(method, path, body);
    }
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(demo(method, path, body)); }, 120);
    });
  }

  window.Api = { request: request, isDemo: !base };
})();
