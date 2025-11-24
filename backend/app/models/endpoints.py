from sqlalchemy import Column, Integer, String
from geoalchemy2 import Geometry
from ..database import Base

class Endpoint(Base):
    __tablename__ = "endpoints"
    
    endpoint_id = Column(String, primary_key=True, index=True)
    endpoint_type = Column(String, index=True)  # hospital, school, farmland, etc.
    intake_id = Column(String, index=True)
    geom = Column(Geometry('POINT', srid=4326))
    
    def __repr__(self):
        return f"<Endpoint(id={self.endpoint_id}, type={self.endpoint_type})>"
