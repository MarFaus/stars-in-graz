<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Concerts;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ConcertController extends Controller
{
    private function base()
    {
        return DB::table('concerts as c')
            ->join('locations as l', 'l.id', '=', 'c.location_id')
            ->select('c.id', 'c.artist', 'c.location_id', 'l.name as location_name');
    }

    public function index(): JsonResponse
    {
        $shows = DB::table('shows')->orderBy('start')->get()->groupBy('concert_id');

        $concerts = $this->base()->orderBy('c.artist')->orderBy('c.id')->get()
            ->map(fn ($c) => Concerts::concertJson($c, $shows->get($c->id, collect())))
            ->all();

        return response()->json(['concerts' => $concerts]);
    }

    public function show(int $concert): JsonResponse
    {
        $row = $this->base()->where('c.id', $concert)->first();
        if (! $row) {
            return response()->json(['error' => 'A concert with this ID does not exist'], 404);
        }
        $shows = DB::table('shows')->where('concert_id', $concert)->orderBy('start')->get();

        return response()->json(['concert' => Concerts::concertJson($row, $shows)]);
    }

    public function seating(int $concert, int $show): JsonResponse
    {
        if (! Concerts::findShow($concert, $show)) {
            return response()->json(['error' => Concerts::NOT_FOUND], 404);
        }
        Concerts::purgeExpired();

        $rows = DB::table('rows')->where('show_id', $show)->orderBy('id')->get();
        $taken = DB::table('reservation_seat as rs')
            ->join('rows as r', 'r.id', '=', 'rs.row_id')
            ->where('r.show_id', $show)
            ->orderBy('rs.seat')
            ->get(['rs.row_id', 'rs.seat'])
            ->groupBy('row_id');

        return response()->json(['rows' => $rows->map(fn ($r) => [
            'id' => (int) $r->id,
            'name' => $r->name,
            'seats' => [
                'total' => (int) $r->total,
                'unavailable' => $taken->get($r->id, collect())->pluck('seat')->map(fn ($s) => (int) $s)->unique()->values()->all(),
            ],
        ])->all()]);
    }
}
