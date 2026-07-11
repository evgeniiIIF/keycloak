import { requestContext } from './request-context';

describe('requestContext', () => {
  it('should store and retrieve req', async () => {
    const mockReq = { session: { accessToken: 'test-token' } } as any;
    let captured: ReturnType<typeof requestContext.getStore>;

    await requestContext.run({ req: mockReq }, () => {
      captured = requestContext.getStore();
    });

    expect(captured?.req?.session?.accessToken).toBe('test-token');
  });

  it('should return undefined outside of context', () => {
    expect(requestContext.getStore()).toBeUndefined();
  });
});
