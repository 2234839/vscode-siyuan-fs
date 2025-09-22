// Standalone test script for SiYuan API

async function testSiYuanAPI() {
  const config = {
    baseUrl: 'http://192.168.1.244:6806',
    apiToken: 'hix6tds4vfxkrxlg',
    timeout: 10000,
  };

  try {
    const notebooksUrl = new URL('/api/block/updateBlock', config.baseUrl);

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
        dataType: 'markdown',
        id: '20250921183317-3pmpdqj',
        data: `/图22
{: id="20250921183317-3pmpdqj" updated="20250921183322"}

{: id="20250921183432-4s64yby" updated="20250921183432"}

{: id="20250905151250-61qkldk" title="test" title-img="background-image:linear-gradient(to top, #e14fad 0%, #f9d423 100%)" type="doc" updated="20250921183605"}`,
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
