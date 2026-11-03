(function () {
  'use strict';

  var view = document.getElementById('view');
  var state = {
    concerts: null,
    concertsPromise: null,
    filters: { artist: '', location: '', date: '' },
    tickets: readTickets()
  };
  var cleanup = null;
  var firstRender = true;

  /* ---------- helpers ---------- */

  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function fmtTime(iso) {
    var d = new Date(iso);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function dayKey(iso) {
    var d = new Date(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function readTickets() {
    try {
      return JSON.parse(sessionStorage.getItem('esc-tickets')) || null;
    } catch (e) {
      return null;
    }
  }

  function storeTickets(list) {
    state.tickets = list && list.length ? list : null;
    try {
      if (state.tickets) {
        sessionStorage.setItem('esc-tickets', JSON.stringify(state.tickets));
      } else {
        sessionStorage.removeItem('esc-tickets');
      }
    } catch (e) {
      /* private mode: tickets stay in memory for this visit */
    }
  }

  /* All concerts and shows come from one request, made once per visit. */
  function loadConcerts() {
    if (state.concerts) {
      return Promise.resolve(state.concerts);
    }
    if (!state.concertsPromise) {
      state.concertsPromise = Api.request('GET', '/concerts').then(function (r) {
        if (r.status !== 200) {
          throw new Error('status ' + r.status);
        }
        state.concerts = r.data.concerts;
        return state.concerts;
      }).catch(function (e) {
        state.concertsPromise = null;
        throw e;
      });
    }
    return state.concertsPromise;
  }

  function allShows() {
    var list = [];
    state.concerts.forEach(function (c) {
      c.shows.forEach(function (s) {
        list.push({ concert: c, show: s });
      });
    });
    return list.sort(function (a, b) { return a.show.start < b.show.start ? -1 : a.show.start > b.show.start ? 1 : 0; });
  }

  function showCard(concert, show, tag) {
    return '<span class="card__date">' + fmtDate(show.start) + '</span>' +
      '<' + tag + ' class="card__artist">' + esc(concert.artist) + '</' + tag + '>' +
      '<span class="card__location">' + esc(concert.location.name) + '</span>' +
      '<span class="card__time">' + fmtTime(show.start) + ' - ' + fmtTime(show.end) + '</span>';
  }

  function page(title, body) {
    view.innerHTML = '<h1 class="page-title" tabindex="-1">' + esc(title) + '</h1>' + body;
    if (!firstRender) {
      view.querySelector('.page-title').focus();
    }
    firstRender = false;
    window.scrollTo(0, 0);
  }

  function loading(title) {
    page(title, '<p class="status" role="status">Loading…</p>');
  }

  function failed(title) {
    page(title, '<div class="notice" role="alert"><p>The concerts could not be loaded. Please check your connection.</p>' +
      '<button type="button" class="btn" id="retry">Try again</button></div>');
    document.getElementById('retry').addEventListener('click', route);
  }

  /* ---------- page: discover concerts ---------- */

  function renderHome() {
    var title = 'Checkout these amazing concerts in Graz.';
    loading(title);
    loadConcerts().then(function () {
      var shows = allShows();
      var artists = {};
      var locations = {};
      shows.forEach(function (x) {
        artists[x.concert.artist] = true;
        locations[x.concert.location.name] = true;
      });
      function options(map, all) {
        return '<option value="">' + all + '</option>' + Object.keys(map).sort(function (a, b) { return a.localeCompare(b); })
          .map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
      }
      page(title,
        '<form class="filters" role="search" aria-label="Filter shows">' +
          '<div class="field"><label for="f-artist">Artist</label><select id="f-artist">' + options(artists, 'All Artists') + '</select></div>' +
          '<div class="field"><label for="f-location">Location</label><select id="f-location">' + options(locations, 'All locations') + '</select></div>' +
          '<div class="field"><label for="f-date">Date</label><input type="date" id="f-date"></div>' +
          '<button type="button" class="btn btn--ghost filters__clear" id="f-clear" hidden>Clear</button>' +
        '</form>' +
        '<p class="count" id="count" aria-live="polite"></p>' +
        '<ul class="cards" id="cards"></ul>' +
        '<p class="empty" id="empty" hidden>No shows are matching the current filter criteria.</p>');

      var fa = document.getElementById('f-artist');
      var fl = document.getElementById('f-location');
      var fd = document.getElementById('f-date');
      var clear = document.getElementById('f-clear');
      fa.value = state.filters.artist;
      fl.value = state.filters.location;
      fd.value = state.filters.date;

      function apply() {
        var f = state.filters = { artist: fa.value, location: fl.value, date: fd.value };
        var list = shows.filter(function (x) {
          return (!f.artist || x.concert.artist === f.artist) &&
            (!f.location || x.concert.location.name === f.location) &&
            (!f.date || dayKey(x.show.start) === f.date);
        });
        document.getElementById('cards').innerHTML = list.map(function (x, i) {
          return '<li style="--i:' + Math.min(i, 12) + '"><a class="card" href="#/book/' + x.concert.id + '/' + x.show.id + '">' +
            showCard(x.concert, x.show, 'span') + '<span class="card__cta" aria-hidden="true">Book seats</span></a></li>';
        }).join('');
        var active = !!(f.artist || f.location || f.date);
        clear.hidden = !active;
        document.getElementById('empty').hidden = list.length > 0;
        document.getElementById('count').textContent = list.length ? list.length + (list.length === 1 ? ' show' : ' shows') : '';
      }

      [fa, fl, fd].forEach(function (el) {
        el.addEventListener('change', apply);
        el.addEventListener('input', apply);
      });
      clear.addEventListener('click', function () {
        fa.value = fl.value = fd.value = '';
        apply();
        fa.focus();
      });
      apply();
    }).catch(function () { failed(title); });
  }

  /* ---------- page: booking ---------- */

  var EXPIRED = 'Your seat reservation expired. The reservation has been cancelled.';

  function renderBooking(concertId, showId) {
    var title = 'Book seats for your show';
    loading(title);
    loadConcerts().then(function () {
      var concert = state.concerts.filter(function (c) { return c.id === +concertId; })[0];
      var show = concert && concert.shows.filter(function (s) { return s.id === +showId; })[0];
      if (!show) {
        page(title, '<div class="notice" role="alert"><p>This show does not exist.</p><a class="btn" href="#/">See all concerts</a></div>');
        return;
      }
      var base = '/concerts/' + concert.id + '/shows/' + show.id;
      var bk = { rows: [], selected: [], token: null, until: null, step: 1, timer: null, queue: Promise.resolve(), booked: false };

      page(title,
        '<div class="card card--static">' + showCard(concert, show, 'h2') + '</div>' +
        '<div class="booking">' +
          '<div class="booking__main" id="main"><p class="status" role="status">Loading seats…</p></div>' +
          '<aside class="panel" aria-labelledby="sel-title">' +
            '<h2 class="panel__title" id="sel-title">Selected seats</h2>' +
            '<div id="sel-list"></div>' +
            '<p class="panel__timer" id="timer" hidden></p>' +
            '<p class="panel__msg" id="msg" role="alert"></p>' +
            '<div id="sel-action"></div>' +
          '</aside>' +
        '</div>');

      var main = document.getElementById('main');

      function rowName(id) {
        var r = bk.rows.filter(function (x) { return x.id === id; })[0];
        return r ? r.name : id;
      }

      function isSelected(row, seat) {
        return bk.selected.some(function (x) { return x.row === row && x.seat === seat; });
      }

      function message(text) {
        document.getElementById('msg').textContent = text || '';
      }

      function renderSeats() {
        if (bk.step !== 1) {
          return;
        }
        main.innerHTML =
          '<div class="hall" style="--cols:' + Math.max.apply(null, bk.rows.map(function (r) { return r.seats.total; }).concat([1])) + '">' +
            '<div class="hall__stage">Stage</div>' +
            '<div class="hall__rows" role="group" aria-label="Seats">' +
            bk.rows.map(function (r) {
              var seats = '';
              for (var n = 1; n <= r.seats.total; n++) {
                var sel = isSelected(r.id, n);
                var off = !sel && r.seats.unavailable.indexOf(n) !== -1;
                seats += '<button type="button" class="seat' + (sel ? ' is-selected' : '') + (off ? ' is-off' : '') + '"' +
                  ' data-row="' + r.id + '" data-seat="' + n + '"' +
                  (off ? ' disabled' : ' aria-pressed="' + sel + '"') +
                  ' aria-label="' + esc(r.name) + ', seat ' + n + (off ? ', unavailable' : '') + '"></button>';
              }
              return '<div class="hall__row"><span class="hall__name">' + esc(r.name) + '</span><span class="hall__seats">' + seats + '</span></div>';
            }).join('') +
            '</div>' +
          '</div>' +
          '<ul class="legend" aria-label="Legend">' +
            '<li><span class="seat"></span>Available</li>' +
            '<li><span class="seat is-selected"></span>Selected</li>' +
            '<li><span class="seat is-off"></span>Unavailable</li>' +
          '</ul>';
      }

      function renderPanel() {
        var list = document.getElementById('sel-list');
        if (!bk.selected.length) {
          list.innerHTML = '<p class="panel__empty">No seats selected. Click on a seat to make a reservation.</p>';
        } else {
          list.innerHTML = '<ul class="panel__seats">' + sortedSelection().map(function (x) {
            return '<li>Row: ' + esc(rowName(x.row)) + ', Seat: ' + x.seat + '</li>';
          }).join('') + '</ul>';
        }
        var action = document.getElementById('sel-action');
        if (bk.step === 1) {
          action.innerHTML = '<button type="button" class="btn" id="to-form"' + (bk.selected.length ? '' : ' disabled') + '>Enter Booking Details</button>';
          document.getElementById('to-form').addEventListener('click', showForm);
        } else {
          action.innerHTML = '<button type="button" class="btn btn--ghost" id="to-seats">← Change Seats</button>';
          document.getElementById('to-seats').addEventListener('click', function () {
            bk.step = 1;
            renderSeats();
            renderPanel();
          });
        }
        tick();
      }

      function sortedSelection() {
        return bk.selected.slice().sort(function (a, b) { return a.row - b.row || a.seat - b.seat; });
      }

      function tick() {
        var el = document.getElementById('timer');
        if (!el) {
          return;
        }
        if (!bk.until || !bk.selected.length) {
          el.hidden = true;
          return;
        }
        var left = Math.max(0, Math.round((bk.until - Date.now()) / 1000));
        el.hidden = false;
        el.innerHTML = 'Your seats expire in <strong>' + pad(Math.floor(left / 60)) + ':' + pad(left % 60) + '</strong>';
        if (left === 0) {
          expire();
        }
      }

      function expire() {
        bk.until = null;
        bk.token = null;
        bk.selected = [];
        bk.step = 1;
        window.alert(EXPIRED);
        message('');
        loadSeating();
      }

      function loadSeating() {
        return Api.request('GET', base + '/seating').then(function (r) {
          if (r.status !== 200) {
            main.innerHTML = '<div class="notice" role="alert"><p>The seats could not be loaded.</p></div>';
            return;
          }
          bk.rows = r.data.rows;
          renderSeats();
          renderPanel();
        });
      }

      function reserve(previous) {
        var body = { reservations: sortedSelection() };
        if (bk.token) {
          body.reservation_token = bk.token;
        }
        return Api.request('POST', base + '/reservation', body).then(function (r) {
          if (r.status === 201) {
            bk.token = r.data.reservation_token;
            bk.until = bk.selected.length ? Date.parse(r.data.reserved_until) : null;
            message('');
          } else if (r.status === 403) {
            bk.token = null;
            return reserve(previous);
          } else {
            bk.selected = previous;
            message((r.data && r.data.fields && r.data.fields.reservations) || 'The seat could not be reserved. Please try another one.');
            return loadSeating();
          }
          renderPanel();
        }).catch(function () {
          bk.selected = previous;
          message('The reservation failed. Please check your connection.');
          renderSeats();
          renderPanel();
        });
      }

      main.addEventListener('click', function (e) {
        var btn = e.target.closest('.seat');
        if (!btn || btn.disabled || !btn.dataset.row) {
          return;
        }
        var row = +btn.dataset.row;
        var seat = +btn.dataset.seat;
        var previous = bk.selected.slice();
        if (isSelected(row, seat)) {
          bk.selected = bk.selected.filter(function (x) { return !(x.row === row && x.seat === seat); });
        } else {
          bk.selected.push({ row: row, seat: seat });
        }
        btn.classList.toggle('is-selected');
        btn.setAttribute('aria-pressed', String(isSelected(row, seat)));
        renderPanel();
        bk.queue = bk.queue.then(function () { return reserve(previous); });
      });

      /* booking form */
      var FIELDS = [
        ['name', 'Name', 'text', 'name'],
        ['address', 'Address', 'text', 'street-address'],
        ['zip', 'ZIP Code', 'text', 'postal-code'],
        ['city', 'City', 'text', 'address-level2'],
        ['country', 'Country', 'select', 'country-name']
      ];
      var form = { name: '', address: '', zip: '', city: '', country: '' };

      function showForm() {
        if (!bk.selected.length) {
          return;
        }
        bk.step = 2;
        var countries = window.ESC_COUNTRIES.map(function (c) {
          return '<option' + (form.country === c ? ' selected' : '') + '>' + esc(c) + '</option>';
        }).join('');
        main.innerHTML =
          '<form class="form" id="book-form" novalidate>' +
            '<h2 class="form__title">Please enter your details</h2>' +
            '<div class="form__grid">' +
            FIELDS.map(function (f) {
              var control = f[2] === 'select'
                ? '<select id="b-' + f[0] + '" name="' + f[0] + '" autocomplete="' + f[3] + '" aria-describedby="e-' + f[0] + '"><option value="">Select a country</option>' + countries + '</select>'
                : '<input id="b-' + f[0] + '" name="' + f[0] + '" type="text" autocomplete="' + f[3] + '" value="' + esc(form[f[0]]) + '" aria-describedby="e-' + f[0] + '">';
              return '<div class="field field--' + f[0] + '"><label for="b-' + f[0] + '">' + f[1] + '</label>' + control +
                '<p class="field__error" id="e-' + f[0] + '"></p></div>';
            }).join('') +
            '</div>' +
            '<p class="form__note">By clicking "Book" you accept that you are not actually booking a ticket as this is a test project and not a real website.</p>' +
            '<div class="form__foot"><p class="form__hint">Your ticket will be available immediately after booking.</p>' +
            '<button type="submit" class="btn btn--big" id="book-btn">Book</button></div>' +
          '</form>';
        renderPanel();
        var f = document.getElementById('book-form');
        f.addEventListener('input', function (e) {
          form[e.target.name] = e.target.value;
          if (e.target.value.trim()) {
            setError(e.target.name, '');
          }
        });
        f.addEventListener('submit', submitBooking);
        document.getElementById('b-name').focus();
      }

      function setError(name, text) {
        var input = document.getElementById('b-' + name);
        input.classList.toggle('is-invalid', !!text);
        input.setAttribute('aria-invalid', text ? 'true' : 'false');
        document.getElementById('e-' + name).textContent = text;
      }

      function submitBooking(e) {
        e.preventDefault();
        var first = null;
        FIELDS.forEach(function (f) {
          var input = document.getElementById('b-' + f[0]);
          form[f[0]] = input.value.trim();
          setError(f[0], form[f[0]] ? '' : f[1] + ' is required.');
          if (!form[f[0]] && !first) {
            first = input;
          }
        });
        if (first) {
          first.focus();
          return;
        }
        var btn = document.getElementById('book-btn');
        btn.disabled = true;
        btn.textContent = 'Booking…';
        bk.queue.then(function () {
          return Api.request('POST', base + '/booking', {
            reservation_token: bk.token, name: form.name, address: form.address,
            city: form.city, zip: form.zip, country: form.country
          });
        }).then(function (r) {
          if (r.status === 201) {
            bk.booked = true;
            storeTickets(r.data.tickets);
            location.hash = '#/tickets/view';
            return;
          }
          btn.disabled = false;
          btn.textContent = 'Book';
          if (r.status === 422) {
            Object.keys(r.data.fields).forEach(function (k) {
              if (document.getElementById('b-' + k)) {
                setError(k, r.data.fields[k]);
              }
            });
          } else {
            message('Your reservation is no longer valid. Please select your seats again.');
            bk.token = null;
            bk.until = null;
            bk.selected = [];
            bk.step = 1;
            loadSeating();
          }
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = 'Book';
          message('The booking failed. Please check your connection.');
        });
      }

      bk.timer = setInterval(tick, 1000);
      cleanup = function () {
        clearInterval(bk.timer);
        /* Leaving the page frees the seats for other visitors. */
        if (bk.token && !bk.booked && bk.selected.length) {
          Api.request('POST', base + '/reservation', { reservation_token: bk.token, reservations: [] });
        }
      };
      loadSeating();
    }).catch(function () { failed(title); });
  }

  /* ---------- page: retrieve tickets ---------- */

  function renderRetrieve() {
    page('Retrieve your tickets.',
      '<form class="form form--narrow" id="get-form" novalidate>' +
        '<div class="field"><label for="g-name">Name</label><input id="g-name" name="name" type="text" autocomplete="name" aria-describedby="ge-name"><p class="field__error" id="ge-name"></p></div>' +
        '<div class="field"><label for="g-code">Code</label><input id="g-code" name="code" type="text" autocomplete="off" spellcheck="false" aria-describedby="ge-code"><p class="field__error" id="ge-code"></p></div>' +
        '<p class="form__msg" id="g-msg" role="alert"></p>' +
        '<button type="submit" class="btn btn--big" id="g-btn">Get Ticket</button>' +
      '</form>');
    var f = document.getElementById('get-form');
    function setErr(id, text) {
      var input = document.getElementById('g-' + id);
      input.classList.toggle('is-invalid', !!text);
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
      document.getElementById('ge-' + id).textContent = text;
    }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('g-name').value.trim();
      var code = document.getElementById('g-code').value.trim().toUpperCase();
      setErr('name', name ? '' : 'Please enter your name.');
      setErr('code', code ? '' : 'Please enter your ticket code.');
      document.getElementById('g-msg').textContent = '';
      if (!name || !code) {
        document.getElementById(name ? 'g-code' : 'g-name').focus();
        return;
      }
      var btn = document.getElementById('g-btn');
      btn.disabled = true;
      Api.request('POST', '/tickets', { name: name, code: code }).then(function (r) {
        btn.disabled = false;
        if (r.status === 200 && r.data.tickets.length) {
          storeTickets(r.data.tickets);
          location.hash = '#/tickets/view';
        } else {
          document.getElementById('g-msg').textContent = 'Could not find tickets with these details.';
        }
      }).catch(function () {
        btn.disabled = false;
        document.getElementById('g-msg').textContent = 'The request failed. Please check your connection.';
      });
    });
  }

  /* ---------- page: tickets ---------- */

  function renderTickets() {
    var list = state.tickets;
    if (!list) {
      location.replace('#/tickets');
      return;
    }
    page('Your Tickets are ready!',
      '<section class="details" aria-labelledby="details-title">' +
        '<h2 class="details__title" id="details-title">Your Details</h2>' +
        '<dl class="details__list"><div><dt>Name</dt><dd>' + esc(list[0].name) + '</dd></div>' +
        '<div><dt>Booked On</dt><dd>' + fmtDate(list[0].created_at) + '</dd></div></dl>' +
      '</section>' +
      '<p class="form__msg" id="t-msg" role="alert"></p>' +
      '<ul class="tickets" id="tickets">' + list.map(function (t) {
        var c = t.show.concert;
        return '<li class="ticket" data-id="' + t.id + '">' +
          '<h2 class="ticket__title">Ticket</h2>' +
          '<p class="ticket__seat">Row: ' + esc(t.row.name) + '<br>Seat: ' + t.seat + '</p>' +
          '<p class="ticket__code">Code: <strong>' + esc(t.code) + '</strong></p>' +
          '<div class="card card--static">' + showCard(c, t.show, 'h3') + '</div>' +
          '<button type="button" class="btn btn--ghost ticket__cancel" data-id="' + t.id + '">Cancel Ticket</button>' +
        '</li>';
      }).join('') + '</ul>');

    document.getElementById('tickets').addEventListener('click', function (e) {
      var btn = e.target.closest('.ticket__cancel');
      if (!btn) {
        return;
      }
      var t = state.tickets.filter(function (x) { return x.id === +btn.dataset.id; })[0];
      if (!window.confirm('Do you really want to cancel the ticket for row ' + t.row.name + ', seat ' + t.seat + '?')) {
        return;
      }
      btn.disabled = true;
      Api.request('POST', '/tickets/' + t.id + '/cancel', { code: t.code, name: t.name }).then(function (r) {
        if (r.status !== 204) {
          btn.disabled = false;
          document.getElementById('t-msg').textContent = 'The ticket could not be cancelled.';
          return;
        }
        storeTickets(state.tickets.filter(function (x) { return x.id !== t.id; }));
        if (!state.tickets) {
          location.hash = '#/';
          return;
        }
        var li = btn.closest('.ticket');
        li.classList.add('is-leaving');
        setTimeout(function () {
          li.remove();
          view.querySelector('.page-title').focus();
        }, 260);
      }).catch(function () {
        btn.disabled = false;
        document.getElementById('t-msg').textContent = 'The request failed. Please check your connection.';
      });
    });
  }

  /* ---------- router ---------- */

  function route() {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    var path = location.hash.replace(/^#/, '') || '/';
    var m;
    if ((m = path.match(/^\/book\/(\d+)\/(\d+)$/))) {
      renderBooking(m[1], m[2]);
    } else if (path === '/tickets') {
      renderRetrieve();
    } else if (path === '/tickets/view') {
      renderTickets();
    } else {
      renderHome();
    }
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', function () {
    if (cleanup) {
      cleanup();
    }
  });
  if (Api.isDemo) {
    document.getElementById('demo-note').hidden = false;
  }
  route();
})();
