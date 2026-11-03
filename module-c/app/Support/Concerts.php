<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

/**
 * Shared queries and JSON shapes of the concerts API.
 * Dates are stored in UTC and returned as ISO 8601 with a trailing Z.
 */
class Concerts
{
    public const NOT_FOUND = 'A concert or show with this ID does not exist';

    public static function iso(?string $date): ?string
    {
        return $date === null ? null : CarbonImmutable::parse($date, 'UTC')->format('Y-m-d\TH:i:s\Z');
    }

    public static function now(): string
    {
        return CarbonImmutable::now('UTC')->format('Y-m-d H:i:s');
    }

    /** Reservations that ran out of time are removed together with their seats. */
    public static function purgeExpired(): void
    {
        $expired = DB::table('reservations')->where('until', '<=', self::now())->pluck('id');
        if ($expired->isEmpty()) {
            return;
        }
        DB::table('reservation_seat')->whereIn('reservation_id', $expired)->delete();
        DB::table('reservations')->whereIn('id', $expired)->delete();
    }

    public static function showJson(object $show): array
    {
        return ['id' => (int) $show->id, 'start' => self::iso($show->start), 'end' => self::iso($show->end)];
    }

    /** @param Collection<int, object> $shows */
    public static function concertJson(object $concert, Collection $shows, bool $withShows = true): array
    {
        $json = [
            'id' => (int) $concert->id,
            'artist' => $concert->artist,
            'location' => ['id' => (int) $concert->location_id, 'name' => $concert->location_name],
        ];
        if ($withShows) {
            $json['shows'] = $shows->sortBy('start')->values()->map(fn ($s) => self::showJson($s))->all();
        }

        return $json;
    }

    public static function findShow(int $concertId, int $showId): ?object
    {
        return DB::table('shows')->where('id', $showId)->where('concert_id', $concertId)->first();
    }

    /** Full ticket objects, sorted by row and seat. */
    public static function tickets(array $ticketIds): array
    {
        $rows = DB::table('tickets as t')
            ->join('bookings as b', 'b.id', '=', 't.booking_id')
            ->join('reservation_seat as rs', 'rs.id', '=', 't.id')
            ->join('rows as r', 'r.id', '=', 'rs.row_id')
            ->join('shows as s', 's.id', '=', 'r.show_id')
            ->join('concerts as c', 'c.id', '=', 's.concert_id')
            ->join('locations as l', 'l.id', '=', 'c.location_id')
            ->whereIn('t.id', $ticketIds)
            ->orderBy('r.id')
            ->orderBy('rs.seat')
            ->get([
                't.id', 't.code', 'b.name', 'b.created_at', 'r.id as row_id', 'r.name as row_name', 'rs.seat',
                's.id as show_id', 's.start', 's.end', 'c.id as concert_id', 'c.artist', 'l.id as location_id',
                'l.name as location_name',
            ]);

        return $rows->map(fn ($t) => [
            'id' => (int) $t->id,
            'code' => $t->code,
            'name' => $t->name,
            'created_at' => self::iso($t->created_at),
            'row' => ['id' => (int) $t->row_id, 'name' => $t->row_name],
            'seat' => (int) $t->seat,
            'show' => [
                'id' => (int) $t->show_id,
                'start' => self::iso($t->start),
                'end' => self::iso($t->end),
                'concert' => [
                    'id' => (int) $t->concert_id,
                    'artist' => $t->artist,
                    'location' => ['id' => (int) $t->location_id, 'name' => $t->location_name],
                ],
            ],
        ])->all();
    }
}
