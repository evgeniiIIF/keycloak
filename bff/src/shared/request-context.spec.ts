import { requestContext } from './request-context';
import { BffSession } from '../types/session';

describe('requestContext', () => {
  it('should store and retrieve session', async () => {
    const mockSession = { accessToken: 'test-token' } as BffSession;
    let captured: ReturnType<typeof requestContext.getStore>;

    await requestContext.run({ session: mockSession }, () => {
      captured = requestContext.getStore();
    });

    expect(captured?.session?.accessToken).toBe('test-token');
  });

  it('should return undefined outside of context', () => {
    expect(requestContext.getStore()).toBeUndefined();
  });
});
