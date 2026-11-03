<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Concerts;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReservationController extends Controller
{
    public function reserve(Request $request, int $concert, int $show): JsonResponse
    {
        if (! Concerts::findShow($concert, $show)) {
            return response()->json(['error' => Concerts::NOT_FOUND], 404);
        }
        Concerts::purgeExpired();

        $token = $request->input('reservation_token');
        $reservation = null;
        if ($token !== null && $token !== '') {
            $reservation = DB::table('reservations')->where('token', (string) $token)->first();
            if (! $reservation) {
                return response()->json(['error' => 'Invalid reservation token'], 403);
            }
        }

        $fields = [];
        $seats = $request->input('reservations');
        if (! is_array($seats) || ! array_is_list($seats)) {
            $fields['reservations'] = 'The reservations field is required.';
            $seats = [];
        }

        foreach ($seats as $seat) {
            if (! is_array($seat) || ! array_key_exists('row', $seat) || $seat['row'] === null || $seat['row'] === '') {
                $fields['reservations'] = 'The row field is required.';
                break;
            }
            if (! array_key_exists('seat', $seat) || $seat['seat'] === null || $seat['seat'] === '') {
                $fields['reservations'] = 'The seat field is required.';
                break;
            }
        }

        $rows = DB::table('rows')->where('show_id', $show)->get()->keyBy('id');

        if (! isset($fields['reservations'])) {
            foreach ($seats as $seat) {
                $row = is_int($seat['row']) || ctype_digit((string) $seat['row']) ? $rows->get((int) $seat['row']) : null;
                $number = $seat['seat'];
                $valid = $row !== null
                    && (is_int($number) || (is_string($number) && ctype_digit($number)))
                    && (int) $number >= 1 && (int) $number <= (int) $row->total;
                if (! $valid) {
                    $fields['reservations'] = "Seat {$seat['seat']} in row {$seat['row']} is invalid.";
                    break;
                }
            }
        }

        if (! isset($fields['reservations'])) {
            $ownSeats = $reservation
                ? DB::table('reservation_seat')->where('reservation_id', $reservation->id)->pluck('id')->all()
                : [];
            foreach ($seats as $seat) {
                $taken = DB::table('reservation_seat')
                    ->where('row_id', (int) $seat['row'])
                    ->where('seat', (int) $seat['seat'])
                    ->whereNotIn('id', $ownSeats ?: [0])
                    ->exists();
                if ($taken) {
                    $fields['reservations'] = "Seat {$seat['seat']} in row {$seat['row']} is already taken.";
                    break;
                }
            }
        }

        $duration = $request->input('duration', 300);
        if (! is_int($duration) || $duration < 1 || $duration > 300) {
            $fields['duration'] = 'The duration must be between 1 and 300.';
        }

        if ($fields) {
            return response()->json(['error' => 'Validation failed', 'fields' => $fields], 422);
        }

        $until = CarbonImmutable::now('UTC')->addSeconds($duration);

        DB::transaction(function () use (&$reservation, &$token, $seats, $rows, $until) {
            if ($reservation) {
                // The new selection replaces the previous one for this show only.
                DB::table('reservation_seat')
                    ->where('reservation_id', $reservation->id)
                    ->whereIn('row_id', $rows->keys()->all())
                    ->delete();
                DB::table('reservations')->where('id', $reservation->id)->update(['until' => $until->format('Y-m-d H:i:s')]);
                $reservationId = $reservation->id;
            } else {
                $token = Str::random(40);
                $reservationId = DB::table('reservations')->insertGetId([
                    'token' => $token,
                    'until' => $until->format('Y-m-d H:i:s'),
                ]);
            }
            foreach ($seats as $seat) {
                DB::table('reservation_seat')->insert([
                    'reservation_id' => $reservationId,
                    'row_id' => (int) $seat['row'],
                    'seat' => (int) $seat['seat'],
                ]);
            }
        });

        return response()->json([
            'reserved' => true,
            'reservation_token' => (string) $token,
            'reserved_until' => $until->format('Y-m-d\TH:i:s\Z'),
        ], 201);
    }

    public function book(Request $request, int $concert, int $show): JsonResponse
    {
        if (! Concerts::findShow($concert, $show)) {
            return response()->json(['error' => Concerts::NOT_FOUND], 404);
        }
        Concerts::purgeExpired();

        $fields = [];
        foreach (['reservation_token', 'name', 'address', 'city', 'zip', 'country'] as $field) {
            $label = str_replace('_', ' ', $field);
            $value = $request->input($field);
            if ($value === null || $value === '') {
                $fields[$field] = "The {$label} field is required.";
            } elseif (! is_string($value)) {
                $fields[$field] = "The {$label} must be a string.";
            }
        }
        if ($fields) {
            return response()->json(['error' => 'Validation failed', 'fields' => $fields], 422);
        }

        $reservation = DB::table('reservations')->where('token', $request->input('reservation_token'))->first();
        $seats = $reservation
            ? DB::table('reservation_seat as rs')
                ->join('rows as r', 'r.id', '=', 'rs.row_id')
                ->where('rs.reservation_id', $reservation->id)
                ->where('r.show_id', $show)
                ->get(['rs.id'])
            : collect();
        if ($seats->isEmpty()) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $ticketIds = DB::transaction(function () use ($request, $seats) {
            $bookingId = DB::table('bookings')->insertGetId([
                'name' => $request->input('name'),
                'address' => $request->input('address'),
                'city' => $request->input('city'),
                'zip' => $request->input('zip'),
                'country' => $request->input('country'),
                'created_at' => Concerts::now(),
            ]);
            foreach ($seats as $seat) {
                do {
                    $code = Str::upper(Str::random(10));
                } while (DB::table('tickets')->where('code', $code)->exists());
                DB::table('tickets')->insert(['id' => $seat->id, 'code' => $code, 'booking_id' => $bookingId]);
                // A booked seat no longer belongs to the time limited reservation.
                DB::table('reservation_seat')->where('id', $seat->id)->update(['reservation_id' => null]);
            }

            return $seats->pluck('id')->all();
        });

        $left = DB::table('reservation_seat')->where('reservation_id', $reservation->id)->exists();
        if (! $left) {
            DB::table('reservations')->where('id', $reservation->id)->delete();
        }

        return response()->json(['tickets' => Concerts::tickets($ticketIds)], 201);
    }
}
