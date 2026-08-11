import { AuthController } from './auth.controller';

describe('AuthController', () => {
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
  };

  const controller = new AuthController(authService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates register payload to authService.register', async () => {
    const payload = {
      name: 'Test User',
      email: 'user@example.com',
      password: 'password123',
    };
    const expected = { id: 'user-1', email: payload.email };
    authService.register.mockResolvedValue(expected);

    await expect(controller.register(payload as any)).resolves.toEqual(expected);
    expect(authService.register).toHaveBeenCalledWith(payload);
  });

  it('delegates login payload to authService.login', async () => {
    const payload = {
      email: 'user@example.com',
      password: 'password123',
    };
    const expected = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: payload.email, role: 'CUSTOMER' },
    };
    authService.login.mockResolvedValue(expected);

    await expect(controller.login(payload as any, undefined)).resolves.toEqual(expected);
    expect(authService.login).toHaveBeenCalledWith(payload, null);
  });
});
