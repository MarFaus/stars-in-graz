<?php

use App\Http\Controllers\Api\ConcertController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\TicketController;
use Illuminate\Support\Facades\Route;

Route::get('/concerts', [ConcertController::class, 'index']);
Route::get('/concerts/{concert}', [ConcertController::class, 'show'])->whereNumber('concert');
Route::get('/concerts/{concert}/shows/{show}/seating', [ConcertController::class, 'seating'])
    ->whereNumber(['concert', 'show']);

Route::post('/concerts/{concert}/shows/{show}/reservation', [ReservationController::class, 'reserve'])
    ->whereNumber(['concert', 'show']);
Route::post('/concerts/{concert}/shows/{show}/booking', [ReservationController::class, 'book'])
    ->whereNumber(['concert', 'show']);

Route::post('/tickets', [TicketController::class, 'retrieve']);
Route::post('/tickets/{ticket}/cancel', [TicketController::class, 'cancel'])->whereNumber('ticket');
