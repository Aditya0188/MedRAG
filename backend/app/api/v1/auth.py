from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import User, AuditEvent
from app.schemas.schemas import LoginRequest, LoginResponse, UserResponse
from app.core.auth import (
    verify_password,
    create_access_token,
    require_user,
    COOKIE_NAME
)
from app.services.pipeline_orchestrator import add_audit_log

router = APIRouter(tags=["Authentication"])


@router.post("/auth/login", response_model=LoginResponse)
def login(login_data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Authenticates a user via email and bcrypt password.
    Sets JWT in an httpOnly, SameSite=Lax cookie and returns token and user profile.
    """
    email_clean = login_data.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role, "name": user.name}
    )

    # Set httpOnly, SameSite=Lax cookie
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 24 * 7,  # 7 days
        path="/"
    )

    add_audit_log(
        db=db,
        analysis_id=None,
        event_type="login",
        actor=user.name,
        details={"email": user.email, "role": user.role},
        user_id=user.id
    )
    db.commit()

    return LoginResponse(
        message=f"Welcome back, {user.name}.",
        user=user,
        token=token
    )


@router.post("/auth/logout")
def logout(response: Response, request: Request, db: Session = Depends(get_db)):
    """
    Clears the session authentication cookie.
    """
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="lax")
    return {"status": "success", "message": "Successfully logged out."}


@router.get("/auth/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(require_user)):
    """
    Returns the authenticated user's profile and role.
    """
    return current_user
