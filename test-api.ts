// Standalone test script for SiYuan API

async function testSiYuanAPI() {
  const config = {
    baseUrl: 'http://192.168.1.244:6806',
    apiToken: 'hix6tds4vfxkrxlg',
    timeout: 10000,
  };

  try {
    const notebooksUrl = new URL('/api/filetree/getIDsByHPath', config.baseUrl);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiToken) {
      headers['Authorization'] = `Token ${config.apiToken}`;
    }

    const notebooksResponse = fetch(notebooksUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
          "path": "/index",
          "notebook": "20210816161940-zo21go1"
      }),
    });
    notebooksResponse
      .then((r) => r.json())
      .then((r: any) => {
        console.log('[r]', r.data);
      });
  } catch (error: any) {
    console.error('Test failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

// Run the test
testSiYuanAPI().catch(console.error);
