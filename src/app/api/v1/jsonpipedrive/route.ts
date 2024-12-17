import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  //  // Get the Authorization header
  //  const authHeader = request.headers.get('authorization');
  //
  //  // Check if Authorization header exists and is Basic auth
  //  if (!authHeader || !authHeader.startsWith('Basic ')) {
  //    return new NextResponse('Unauthorized', {
  //      status: 401,
  //      headers: {
  //        'WWW-Authenticate': 'Basic realm="Secure Area"'
  //      }
  //    });
  //  }
  //
  //  // Get credentials from Authorization header
  //  const base64Credentials = authHeader.split(' ')[1];
  //  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  //  const [username, password] = credentials.split(':');
  //
  //  // Replace these with your actual credentials
  //  const validUsername = 'admin';
  //  const validPassword = 'admin';
  //
  //  // Verify credentials
  //  if (username !== validUsername || password !== validPassword) {
  //    return new NextResponse('Unauthorized', {
  //      status: 401,
  //      headers: {
  //        'WWW-Authenticate': 'Basic realm="Secure Area"'
  //      }
  //    });
  //  }


  const lala = {
    "data": {
      "id": 3,
      "header": "Hello",
    }
  }

  return NextResponse.json(lala);
}
