import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const lala = {
    "data": {
      "id": "leo stinkt",
      "header": "Hello",
    }
  }

  const leler = {
    data: {
      blocks: {
        block_key_delivery_method: {
          "value": 1,
          "items": [
            {
              "label": "Standard",
              "value": 1
            },
            {
              "label": "Faster",
              "value": 2
            }
          ]
        },
        block_key_is_gift: {
          "value": "yes"
        }
      },
      actions: {}
    }
  }

  return NextResponse.json(leler);
}
