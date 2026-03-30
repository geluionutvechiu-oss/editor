<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $validator->errors()], 422);
        }

        $credentials = $request->only('email', 'password');

        if (!$token = auth('api')->attempt($credentials)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $user = auth('api')->user();

        if (!$user->is_active) {
            auth('api')->logout();
            return response()->json(['message' => 'Account is suspended'], 403);
        }

        $user->update([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ]);

        return $this->respondWithToken($token, $user);
    }

    public function logout(): JsonResponse
    {
        auth('api')->logout();

        return response()->json(['message' => 'Successfully logged out'])
            ->withCookie(cookie()->forget('jwt_token'));
    }

    public function me(): JsonResponse
    {
        $user = auth('api')->user();
        return response()->json(['data' => $user]);
    }

    public function refresh(): JsonResponse
    {
        try {
            $token = auth('api')->refresh();
            return $this->respondWithToken($token, auth('api')->user());
        } catch (\Exception $e) {
            return response()->json(['message' => 'Token refresh failed'], 401);
        }
    }

    protected function respondWithToken(string $token, User $user): JsonResponse
    {
        $cookie = cookie(
            'jwt_token',
            $token,
            config('jwt.ttl'),
            '/',
            null,
            false,
            true, // httpOnly
            false,
            'Lax'
        );

        return response()->json([
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
                'token' => $token,
                'token_type' => 'bearer',
                'expires_in' => config('jwt.ttl') * 60,
            ],
            'message' => 'Login successful',
        ])->withCookie($cookie);
    }
}
