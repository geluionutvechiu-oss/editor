<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketReply;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Ticket::with(['user', 'assignedTo'])->withCount('replies');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', "%{$search}%")
                  ->orWhereHas('user', fn($q) => $q->where('name', 'like', "%{$search}%"));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        $query->orderByDesc('updated_at');
        $tickets = $query->paginate(min($request->get('per_page', 15), 100));

        return response()->json([
            'data' => $tickets->items(),
            'meta' => [
                'current_page' => $tickets->currentPage(),
                'last_page' => $tickets->lastPage(),
                'per_page' => $tickets->perPage(),
                'total' => $tickets->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
            'priority' => 'in:low,medium,high,critical',
            'category' => 'nullable|string|max:100',
        ]);

        $ticket = Ticket::create([
            'user_id' => auth('api')->id(),
            'subject' => $validated['subject'],
            'status' => 'open',
            'priority' => $validated['priority'] ?? 'medium',
            'category' => $validated['category'] ?? null,
        ]);

        TicketReply::create([
            'ticket_id' => $ticket->id,
            'user_id' => auth('api')->id(),
            'message' => $validated['message'],
            'is_staff_reply' => auth('api')->user()->role !== 'user',
        ]);

        $ticket->load(['user', 'replies.user']);
        return response()->json(['data' => $ticket, 'message' => 'Ticket created'], 201);
    }

    public function show(int $id): JsonResponse
    {
        $ticket = Ticket::with(['user', 'assignedTo', 'replies.user'])->findOrFail($id);
        return response()->json(['data' => $ticket]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $ticket = Ticket::findOrFail($id);
        $validated = $request->validate([
            'assigned_to' => 'nullable|exists:users,id',
            'priority' => 'in:low,medium,high,critical',
            'category' => 'nullable|string|max:100',
        ]);
        $ticket->update($validated);
        return response()->json(['data' => $ticket, 'message' => 'Updated']);
    }

    public function destroy(int $id): JsonResponse
    {
        Ticket::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    public function reply(Request $request, int $id): JsonResponse
    {
        $ticket = Ticket::findOrFail($id);
        $validated = $request->validate(['message' => 'required|string']);

        $reply = TicketReply::create([
            'ticket_id' => $ticket->id,
            'user_id' => auth('api')->id(),
            'message' => $validated['message'],
            'is_staff_reply' => auth('api')->user()->role !== 'user',
        ]);

        $ticket->update(['status' => 'awaiting_user', 'updated_at' => now()]);
        $reply->load('user');

        return response()->json(['data' => $reply, 'message' => 'Reply added'], 201);
    }

    public function close(int $id): JsonResponse
    {
        $ticket = Ticket::findOrFail($id);
        $ticket->update(['status' => 'closed']);
        return response()->json(['data' => $ticket, 'message' => 'Ticket closed']);
    }

    public function reopen(int $id): JsonResponse
    {
        $ticket = Ticket::findOrFail($id);
        $ticket->update(['status' => 'open']);
        return response()->json(['data' => $ticket, 'message' => 'Ticket reopened']);
    }
}
