from fastapi import APIRouter

router = APIRouter()


@router.get('/summary')
def analytics_summary():
    return {'message': 'Analytics summary placeholder'}
