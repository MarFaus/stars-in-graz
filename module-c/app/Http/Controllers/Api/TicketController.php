<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Concerts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class TicketController extends Controller
{
    private const UNAUTHORIZED = ['error' => 'Unauthorized'];

    private function credentials(Request $request): ?array
    {
        $code = $request->input('code');
        $name = $request->input('name');

        return is_string($code) && $code !== '' && is_string($name) && $name !== '' ? [$code, $name] : null;
    }

    public function retrieve(Request $request): JsonResponse
    {
        $credentials = $this->credentials($request);
        $ticket = $credentials
            ? DB::table('tickets as t')->join('bookings as b', 'b.id', '=', 't.booking_id')
                ->where('t.code', $credentials[0])->where('b.name', $credentials[1])->first(['t.booking_id'])
            : null;
        if (! $ticket) {
            return response()->json(self::UNAUTHORIZED, 401);
        }

        $ids = DB::table('tickets')->where('booking_id', $ticket->booking_id)->pluck('id')->all();

        return response()->json(['tickets' => Concerts::tickets($ids)]);
    }

    public function cancel(Request $request, int $ticket): Response|JsonResponse
    {
        $found = DB::table('tickets as t')->join('bookings as b', 'b.id', '=', 't.booking_id')
            ->where('t.id', $ticket)->first(['t.id', 't.code', 'b.name']);
        if (! $found) {
            return response()->json(['error' => 'A ticket with this ID does not exist'], 404);
        }

        $credentials = $this->credentials($request);
        if (! $credentials || $credentials[0] !== $found->code || $credentials[1] !== $found->name) {
            return response()->json(self::UNAUTHORIZED, 401);
        }

        DB::transaction(function () use ($ticket) {
            DB::table('tickets')->where('id', $ticket)->delete();
            // Removing the seat record makes the seat available again.
            DB::table('reservation_seat')->where('id', $ticket)->delete();
        });

        return response()->noContent();
    }
}
